import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Square, RotateCcw, Trash2, Save, FolderOpen, Settings, Activity, Zap, Wind, Droplet, Thermometer, Gauge, CircleDot, Box, BarChart3, ChevronRight, ChevronDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const TYPES = {
  ambient: {
    typeNo: 1, name: 'Ambient', category: 'source', color: '#475569', icon: Thermometer,
    desc: '대기 조건 (온도/습도)',
    parameters: [
      { key: 'T_amb', label: 'T_ambient', value: 25, unit: '°C' },
      { key: 'RH_amb', label: 'RH_ambient', value: 50, unit: '%' },
      { key: 'P_atm', label: 'P_atm', value: 101.325, unit: 'kPa' },
    ],
    inputs: [],
    outputs: [
      { key: 'T_out', label: 'T', unit: '°C' },
      { key: 'RH_out', label: 'RH', unit: '%' },
      { key: 'P_out', label: 'P', unit: 'kPa' },
    ],
    compute: (inp, par) => ({ T_out: par.T_amb, RH_out: par.RH_amb, P_out: par.P_atm }),
  },
  compressor: {
    typeNo: 100, name: 'Compressor', category: 'refrigerant', color: '#dc2626', icon: CircleDot,
    desc: '로터리/리시프로 압축기',
    parameters: [
      { key: 'V_disp', label: 'Displacement', value: 10.0, unit: 'cc' },
      { key: 'RPM', label: 'Speed', value: 3000, unit: 'rpm' },
      { key: 'eta_v', label: 'η_vol', value: 0.85, unit: '-' },
      { key: 'eta_is', label: 'η_is', value: 0.70, unit: '-' },
      { key: 'PR', label: 'Press. Ratio', value: 3.5, unit: '-' },
    ],
    inputs: [
      { key: 'P_suc', label: 'P_suc', unit: 'kPa' },
      { key: 'T_suc', label: 'T_suc', unit: '°C' },
    ],
    outputs: [
      { key: 'm_dot', label: 'm_dot', unit: 'g/s' },
      { key: 'T_dis', label: 'T_dis', unit: '°C' },
      { key: 'P_dis', label: 'P_dis', unit: 'kPa' },
      { key: 'W_comp', label: 'W_comp', unit: 'W' },
    ],
    compute: (inp, par) => {
      const P_suc = inp.P_suc ?? 500;
      const T_suc = inp.T_suc ?? 10;
      const T_suc_K = T_suc + 273.15;
      const rho = (P_suc * 1000) / (120 * T_suc_K);
      const m_dot = par.eta_v * rho * par.V_disp * 1e-6 * par.RPM / 60 * 1000;
      const P_dis = P_suc * par.PR;
      const T_dis_is = T_suc_K * Math.pow(par.PR, 0.28);
      const T_dis = T_suc_K + (T_dis_is - T_suc_K) / par.eta_is;
      const W_comp = (m_dot / 1000) * 1.0 * (T_dis - T_suc_K) * 1000;
      return { m_dot, T_dis: T_dis - 273.15, P_dis, W_comp };
    },
  },
  condenser: {
    typeNo: 101, name: 'Condenser', category: 'refrigerant', color: '#ea580c', icon: Box,
    desc: '응축기 (고온측 열교환기)',
    parameters: [
      { key: 'UA', label: 'UA', value: 150, unit: 'W/K' },
      { key: 'dP_ref', label: 'ΔP_ref', value: 20, unit: 'kPa' },
    ],
    inputs: [
      { key: 'm_dot', label: 'm_dot', unit: 'g/s' },
      { key: 'T_in', label: 'T_ref_in', unit: '°C' },
      { key: 'P_in', label: 'P_ref_in', unit: 'kPa' },
      { key: 'T_air', label: 'T_air', unit: '°C' },
      { key: 'm_air', label: 'm_air', unit: 'kg/s' },
    ],
    outputs: [
      { key: 'T_out', label: 'T_ref_out', unit: '°C' },
      { key: 'P_out', label: 'P_ref_out', unit: 'kPa' },
      { key: 'Q', label: 'Q_cond', unit: 'W' },
      { key: 'T_air_out', label: 'T_air_out', unit: '°C' },
    ],
    compute: (inp, par) => {
      const m = (inp.m_dot ?? 1) / 1000;
      const T_in = inp.T_in ?? 80;
      const T_air = inp.T_air ?? 25;
      const m_air = inp.m_air ?? 0.05;
      const C_min = Math.min(m * 1200, m_air * 1005);
      const NTU = par.UA / Math.max(C_min, 1e-6);
      const eps = 1 - Math.exp(-NTU);
      const Q = eps * C_min * (T_in - T_air);
      const T_out = T_in - Q / (m * 1200 + 1e-6);
      const T_air_out = T_air + Q / (m_air * 1005 + 1e-6);
      return { T_out, P_out: (inp.P_in ?? 1800) - par.dP_ref, Q, T_air_out };
    },
  },
  exv: {
    typeNo: 102, name: 'Expansion Valve', category: 'refrigerant', color: '#d97706', icon: Zap,
    desc: '전자팽창밸브 (EEV)',
    parameters: [
      { key: 'A_orifice', label: 'A_orifice', value: 0.5, unit: 'mm²' },
      { key: 'opening', label: 'Opening', value: 100, unit: '%' },
      { key: 'Cd', label: 'Cd', value: 0.65, unit: '-' },
    ],
    inputs: [
      { key: 'P_in', label: 'P_in', unit: 'kPa' },
      { key: 'T_in', label: 'T_in', unit: '°C' },
      { key: 'P_out_target', label: 'P_out', unit: 'kPa' },
    ],
    outputs: [
      { key: 'm_dot', label: 'm_dot', unit: 'g/s' },
      { key: 'T_out', label: 'T_out', unit: '°C' },
      { key: 'P_out', label: 'P_out', unit: 'kPa' },
    ],
    compute: (inp, par) => {
      const P_in = inp.P_in ?? 1800;
      const P_out = inp.P_out_target ?? 500;
      const T_in = inp.T_in ?? 35;
      const A_eff = par.A_orifice * (par.opening / 100) * 1e-6;
      const rho = (P_in * 1000) / (120 * (T_in + 273.15));
      const dP = Math.max((P_in - P_out) * 1000, 0);
      const m_dot = par.Cd * A_eff * Math.sqrt(2 * rho * dP) * 1000;
      return { m_dot, T_out: 0.03 * P_out - 20, P_out };
    },
  },
  evaporator: {
    typeNo: 103, name: 'Evaporator', category: 'refrigerant', color: '#2563eb', icon: Droplet,
    desc: '증발기 (저온측 열교환기)',
    parameters: [
      { key: 'UA', label: 'UA', value: 120, unit: 'W/K' },
      { key: 'dP_ref', label: 'ΔP_ref', value: 15, unit: 'kPa' },
      { key: 'SH', label: 'Superheat', value: 5, unit: 'K' },
    ],
    inputs: [
      { key: 'm_dot', label: 'm_dot', unit: 'g/s' },
      { key: 'T_in', label: 'T_ref_in', unit: '°C' },
      { key: 'P_in', label: 'P_ref_in', unit: 'kPa' },
      { key: 'T_air', label: 'T_air', unit: '°C' },
      { key: 'm_air', label: 'm_air', unit: 'kg/s' },
    ],
    outputs: [
      { key: 'T_out', label: 'T_ref_out', unit: '°C' },
      { key: 'P_out', label: 'P_ref_out', unit: 'kPa' },
      { key: 'Q', label: 'Q_evap', unit: 'W' },
      { key: 'T_air_out', label: 'T_air_out', unit: '°C' },
    ],
    compute: (inp, par) => {
      const m = (inp.m_dot ?? 1) / 1000;
      const T_in = inp.T_in ?? -10;
      const T_air = inp.T_air ?? 40;
      const m_air = inp.m_air ?? 0.05;
      const C_min = Math.min(m * 1500, m_air * 1005);
      const NTU = par.UA / Math.max(C_min, 1e-6);
      const eps = 1 - Math.exp(-NTU);
      const Q = eps * C_min * (T_air - T_in);
      const T_air_out = T_air - Q / (m_air * 1005 + 1e-6);
      return { T_out: T_in + par.SH, P_out: (inp.P_in ?? 500) - par.dP_ref, Q, T_air_out };
    },
  },
  fan: {
    typeNo: 200, name: 'Fan', category: 'air', color: '#0891b2', icon: Wind,
    desc: '송풍기 (시로코/축류)',
    parameters: [
      { key: 'RPM', label: 'Speed', value: 2500, unit: 'rpm' },
      { key: 'V_max', label: 'V_max', value: 0.15, unit: 'm³/s' },
      { key: 'eta', label: 'η_fan', value: 0.55, unit: '-' },
      { key: 'dP_max', label: 'ΔP_max', value: 300, unit: 'Pa' },
    ],
    inputs: [
      { key: 'T_in', label: 'T_air_in', unit: '°C' },
      { key: 'dP_sys', label: 'ΔP_system', unit: 'Pa' },
    ],
    outputs: [
      { key: 'm_air', label: 'm_air', unit: 'kg/s' },
      { key: 'T_out', label: 'T_air_out', unit: '°C' },
      { key: 'W_fan', label: 'W_fan', unit: 'W' },
    ],
    compute: (inp, par) => {
      const T_in = inp.T_in ?? 25;
      const dP_sys = inp.dP_sys ?? 150;
      const speed_frac = par.RPM / 2500;
      const V = par.V_max * speed_frac * Math.sqrt(Math.max(1 - dP_sys / (par.dP_max * speed_frac ** 2), 0.1));
      const rho_air = 1.2 * (293.15 / (T_in + 273.15));
      const m_air = rho_air * V;
      const W_fan = (V * dP_sys) / par.eta;
      return { m_air, T_out: T_in + W_fan / (m_air * 1005 + 1e-6), W_fan };
    },
  },
  drum: {
    typeNo: 201, name: 'Drum', category: 'air', color: '#0e7490', icon: Gauge,
    desc: '세탁건조기 드럼 (직물-공기 열/물질전달)',
    parameters: [
      { key: 'm_fabric', label: 'Fabric Mass', value: 5.0, unit: 'kg' },
      { key: 'MC_init', label: 'MC_init', value: 0.8, unit: '-' },
      { key: 'hA', label: 'hA', value: 50, unit: 'W/K' },
      { key: 'dP_drum', label: 'ΔP_drum', value: 100, unit: 'Pa' },
    ],
    inputs: [
      { key: 'T_air_in', label: 'T_air_in', unit: '°C' },
      { key: 'm_air', label: 'm_air', unit: 'kg/s' },
    ],
    outputs: [
      { key: 'T_air_out', label: 'T_air_out', unit: '°C' },
      { key: 'MC', label: 'MC', unit: '-' },
      { key: 'm_evap', label: 'm_evap', unit: 'g/s' },
      { key: 'dP', label: 'ΔP', unit: 'Pa' },
    ],
    stateInit: { MC: null, T_fab: 25 },
    compute: (inp, par, t, state, dt) => {
      const T_air_in = inp.T_air_in ?? 50;
      const m_air = inp.m_air ?? 0.05;
      if (state.MC === null) state.MC = par.MC_init;
      const dT = T_air_in - state.T_fab;
      const Q = par.hA * dT;
      const h_fg = 2400e3;
      const m_evap = state.MC > 0.05 ? Q / h_fg : 0;
      state.T_fab = state.T_fab + (Q - m_evap * h_fg) / (par.m_fabric * 1500) * dt;
      state.MC = Math.max(state.MC - (m_evap * dt) / par.m_fabric, 0);
      return {
        T_air_out: T_air_in - Q / (m_air * 1005 + 1e-6),
        MC: state.MC,
        m_evap: m_evap * 1000,
        dP: par.dP_drum,
      };
    },
  },
  plotter: {
    typeNo: 900, name: 'Plotter', category: 'output', color: '#7c3aed', icon: BarChart3,
    desc: '결과 시각화 (시계열)',
    parameters: [{ key: 'label', label: 'Label', value: 'Signal', unit: '' }],
    inputs: [
      { key: 'y1', label: 'y1', unit: '' },
      { key: 'y2', label: 'y2', unit: '' },
      { key: 'y3', label: 'y3', unit: '' },
    ],
    outputs: [],
    compute: () => ({}),
  },
};

const CATEGORY_STYLES = {
  source:      { bg: 'bg-slate-100',  text: 'text-slate-700', border: 'border-slate-300', badge: 'SRC' },
  refrigerant: { bg: 'bg-red-50',     text: 'text-red-700',   border: 'border-red-200',   badge: 'REF' },
  air:         { bg: 'bg-cyan-50',    text: 'text-cyan-700',  border: 'border-cyan-200',  badge: 'AIR' },
  control:     { bg: 'bg-violet-50',  text: 'text-violet-700',border: 'border-violet-200',badge: 'CTL' },
  output:      { bg: 'bg-violet-50',  text: 'text-violet-700',border: 'border-violet-200',badge: 'OUT' },
};

// 직교(90도) 경로 계산. offsets로 각 세그먼트 위치 조정.
// returns { d, handles: [{segment, x, y, axis, segMin, segMax}] }
function getOrthogonalPath(from, to, offsets = {}) {
  const MARGIN = 20;
  const STUB = 12;
  const {
    midOffsetX = 0,
    midOffsetY = 0,
    outOffsetX = 0,
    inOffsetX = 0,
  } = offsets;

  if (to.x >= from.x + MARGIN * 2) {
    // 일반 L→R: 3-세그먼트 (수평→수직→수평)
    const autoMid = (from.x + to.x) / 2;
    const midX = Math.max(from.x + STUB, Math.min(to.x - STUB, autoMid + midOffsetX));
    const segMin = Math.min(from.y, to.y);
    const segMax = Math.max(from.y, to.y);
    return {
      d: `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`,
      isNormal: true,
      handles: [
        { segment: 'midX', x: midX, y: (from.y + to.y) / 2, axis: 'x', segMin, segMax },
      ],
    };
  }

  // 역참조(루프): 5-세그먼트 — 수평→수직→수평→수직→수평
  const autoOutX = from.x + MARGIN;
  const autoInX = to.x - MARGIN;
  // from/to가 같은 y 근처면 기본 midY를 아래로 우회시킴 (시각적 U자 형태 유지)
  const autoMidY = Math.abs(from.y - to.y) < 20
    ? from.y + 50
    : (from.y + to.y) / 2;
  const outX = autoOutX + outOffsetX;
  const inX = autoInX + inOffsetX;
  const midY = autoMidY + midOffsetY;
  return {
    d: `M ${from.x} ${from.y} L ${outX} ${from.y} L ${outX} ${midY} L ${inX} ${midY} L ${inX} ${to.y} L ${to.x} ${to.y}`,
    isNormal: false,
    handles: [
      { segment: 'outX', x: outX, y: (from.y + midY) / 2, axis: 'x',
        segMin: Math.min(from.y, midY), segMax: Math.max(from.y, midY) },
      { segment: 'midY', x: (outX + inX) / 2, y: midY, axis: 'y',
        segMin: Math.min(outX, inX), segMax: Math.max(outX, inX) },
      { segment: 'inX', x: inX, y: (midY + to.y) / 2, axis: 'x',
        segMin: Math.min(midY, to.y), segMax: Math.max(midY, to.y) },
    ],
  };
}

// 세그먼트 이름 → 오프셋 키 매핑
const SEGMENT_OFFSET_KEYS = {
  midX: 'midOffsetX',
  midY: 'midOffsetY',
  outX: 'outOffsetX',
  inX: 'inOffsetX',
};

export default function HPWDStudio() {
  const [blocks, setBlocks] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [draggingConn, setDraggingConn] = useState(null); // 연결선 중간점 드래그
  const [hoveredConn, setHoveredConn] = useState(null);   // 호버된 연결선 index
  const [selectedConn, setSelectedConn] = useState(null); // 선택된 연결선 index (클릭 기반, persistent)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const [simState, setSimState] = useState({
    running: false, t: 0, dt: 1.0, t_final: 600, history: [], log: [],
  });
  const simRef = useRef(simState);
  simRef.current = simState;

  const canvasRef = useRef(null);
  const [expandedCats, setExpandedCats] = useState({ source: true, refrigerant: true, air: true, output: true });

  const handleLibraryDragStart = (e, typeKey) => {
    e.dataTransfer.setData('typeKey', typeKey);
    e.dataTransfer.effectAllowed = 'copy';
  };
  const handleCanvasDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
  const handleCanvasDrop = (e) => {
    e.preventDefault();
    const typeKey = e.dataTransfer.getData('typeKey');
    if (!typeKey || !TYPES[typeKey]) return;
    const rect = canvasRef.current.getBoundingClientRect();
    addBlock(typeKey, e.clientX - rect.left, e.clientY - rect.top);
  };

  const addBlock = (typeKey, x, y) => {
    const def = TYPES[typeKey];
    const id = `b${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const params = Object.fromEntries(def.parameters.map(p => [p.key, p.value]));
    setBlocks(bs => [...bs, {
      id, type: typeKey, x: x - 90, y: y - 40,
      name: `${def.name}_${bs.filter(b => b.type === typeKey).length + 1}`,
      params, outputs: {},
      state: def.stateInit ? JSON.parse(JSON.stringify(def.stateInit)) : {},
    }]);
    setSelected(id);
  };

  const handleBlockMouseDown = (e, blockId) => {
    // 포트 또는 포트 하위 요소 클릭 시 블록 드래그 방지
    if (e.target.closest('[data-port]')) return;
    e.stopPropagation();
    setSelected(blockId);
    setSelectedConn(null);
    const rect = canvasRef.current.getBoundingClientRect();
    const block = blocks.find(b => b.id === blockId);
    setDragging({
      blockId,
      offsetX: e.clientX - rect.left - block.x,
      offsetY: e.clientY - rect.top - block.y,
    });
  };

  const handleCanvasMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMousePos({ x: mx, y: my });
    if (dragging) {
      setBlocks(bs => bs.map(b => b.id === dragging.blockId
        ? { ...b, x: mx - dragging.offsetX, y: my - dragging.offsetY } : b));
    }
    if (draggingConn) {
      const { idx, segment, startMouseX, startMouseY, startOffset } = draggingConn;
      const axis = segment.endsWith('Y') ? 'y' : 'x';
      const delta = axis === 'y' ? (my - startMouseY) : (mx - startMouseX);
      const offsetKey = SEGMENT_OFFSET_KEYS[segment];
      setConnections(cs => cs.map((c, i) =>
        i === idx ? { ...c, [offsetKey]: startOffset + delta } : c
      ));
    }
  };

  const handlePortClick = (e, blockId, portKey, direction) => {
    e.stopPropagation();
    if (!connecting) { setConnecting({ blockId, portKey, direction }); return; }
    if (connecting.direction === direction || connecting.blockId === blockId) { setConnecting(null); return; }
    const from = connecting.direction === 'out' ? connecting : { blockId, portKey };
    const to = connecting.direction === 'in' ? connecting : { blockId, portKey };
    setConnections(cs => {
      const filtered = cs.filter(c => !(c.to.blockId === to.blockId && c.to.portKey === to.portKey));
      return [...filtered, {
        from: { blockId: from.blockId, portKey: from.portKey },
        to: { blockId: to.blockId, portKey: to.portKey },
        midOffsetX: 0,
      }];
    });
    setConnecting(null);
  };

  const deleteBlock = (id) => {
    setBlocks(bs => bs.filter(b => b.id !== id));
    setConnections(cs => cs.filter(c => c.from.blockId !== id && c.to.blockId !== id));
    if (selected === id) setSelected(null);
  };

  const updateParam = (blockId, paramKey, value) => {
    setBlocks(bs => bs.map(b => b.id === blockId ? { ...b, params: { ...b.params, [paramKey]: value } } : b));
  };

  const updateBlockName = (blockId, name) => {
    setBlocks(bs => bs.map(b => b.id === blockId ? { ...b, name } : b));
  };

  const stepSimulation = useCallback(() => {
    setBlocks(prevBlocks => {
      const conns = connectionsRef.current;
      return prevBlocks.map(b => {
        const def = TYPES[b.type];
        const inputs = {};
        def.inputs.forEach(inp => {
          const conn = conns.find(c => c.to.blockId === b.id && c.to.portKey === inp.key);
          if (conn) {
            const src = prevBlocks.find(bb => bb.id === conn.from.blockId);
            if (src?.outputs?.[conn.from.portKey] !== undefined) {
              inputs[inp.key] = src.outputs[conn.from.portKey];
            }
          }
        });
        const newState = b.state ? { ...b.state } : {};
        const outputs = def.compute(inputs, b.params, simRef.current.t, newState, simRef.current.dt);
        return { ...b, outputs, state: newState, lastInputs: inputs };
      });
    });

    setSimState(s => {
      const t_new = s.t + s.dt;
      const snapshot = { t: t_new };
      blocksRef.current.forEach(b => {
        Object.entries(b.outputs || {}).forEach(([k, v]) => {
          snapshot[`${b.name}.${k}`] = typeof v === 'number' ? Number(v.toFixed(4)) : v;
        });
      });
      return { ...s, t: t_new, history: [...s.history, snapshot], running: t_new < s.t_final && s.running };
    });
  }, []);

  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  useEffect(() => {
    if (!simState.running) return;
    const id = setInterval(stepSimulation, 50);
    return () => clearInterval(id);
  }, [simState.running, stepSimulation]);

  // Delete/Backspace 키: 선택된 연결선 또는 블록 삭제
  useEffect(() => {
    const onKey = (e) => {
      // input/textarea에 포커스가 있으면 무시 (파라미터 편집 중 방해 방지)
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedConn !== null) {
          setConnections(cs => cs.filter((_, i) => i !== selectedConn));
          setSelectedConn(null);
          e.preventDefault();
        } else if (selected) {
          setBlocks(bs => bs.filter(b => b.id !== selected));
          setConnections(cs => cs.filter(c => c.from.blockId !== selected && c.to.blockId !== selected));
          setSelected(null);
          e.preventDefault();
        }
      } else if (e.key === 'Escape') {
        setSelectedConn(null);
        setSelected(null);
        setConnecting(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedConn, selected]);

  const runSim = () => setSimState(s => ({ ...s, running: true, log: [...s.log, `▶ Run @ t=${s.t.toFixed(1)}s`] }));
  const stopSim = () => setSimState(s => ({ ...s, running: false, log: [...s.log, `■ Stop @ t=${s.t.toFixed(1)}s`] }));
  const resetSim = () => {
    setSimState({ running: false, t: 0, dt: 1.0, t_final: 600, history: [], log: ['↺ Reset'] });
    setBlocks(bs => bs.map(b => {
      const def = TYPES[b.type];
      return { ...b, outputs: {}, state: def.stateInit ? JSON.parse(JSON.stringify(def.stateInit)) : {} };
    }));
  };

  const saveProject = () => {
    const data = { blocks, connections, simState: { dt: simState.dt, t_final: simState.t_final } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hpwd_project_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadProject = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        setBlocks(data.blocks || []);
        setConnections(data.connections || []);
        if (data.simState) setSimState(s => ({ ...s, ...data.simState, running: false, t: 0, history: [] }));
      } catch (err) { alert('Failed to load: ' + err.message); }
    };
    reader.readAsText(file);
  };

  const getPortPos = (block, portKey, direction) => {
    const def = TYPES[block.type];
    const ports = direction === 'in' ? def.inputs : def.outputs;
    const idx = ports.findIndex(p => p.key === portKey);
    if (idx === -1) return null;
    return { x: direction === 'in' ? block.x : block.x + 180, y: block.y + 43 + idx * 20 };
  };

  const selectedBlock = blocks.find(b => b.id === selected);
  const selectedDef = selectedBlock ? TYPES[selectedBlock.type] : null;

  const plotterData = blocks.filter(b => b.type === 'plotter').map(pb => {
    const series = connections.filter(c => c.to.blockId === pb.id).map(c => {
      const src = blocks.find(b => b.id === c.from.blockId);
      return src ? `${src.name}.${c.from.portKey}` : null;
    }).filter(Boolean);
    return { id: pb.id, name: pb.name, series };
  });

  return (
    <div className="h-screen w-full flex flex-col bg-white text-slate-800 text-xs overflow-hidden"
         style={{ fontFamily: "'Inter', 'Pretendard', -apple-system, sans-serif" }}>

      {/* Menubar */}
      <div className="h-9 bg-white border-b border-slate-200 flex items-center px-4 gap-4 text-[11px] shrink-0">
        <div className="font-bold text-slate-900 tracking-wide flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-cyan-600"></div>
          HPWD Studio
        </div>
        <div className="text-slate-400 text-[10px]">v0.1.0 · prototype</div>
        <div className="flex-1"></div>
        <div className="text-slate-500 text-[11px] font-mono">
          t = <span className="text-slate-900 font-semibold">{simState.t.toFixed(1)}s</span>
          <span className="mx-1 text-slate-300">/</span>
          <span className="text-slate-400">{simState.t_final}s</span>
        </div>
        <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
          simState.running ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'
        }`}>
          {simState.running ? '● Running' : '○ Idle'}
        </div>
      </div>

      {/* Toolbar */}
      <div className="h-11 bg-slate-50 border-b border-slate-200 flex items-center px-3 gap-1 shrink-0">
        <ToolBtn onClick={saveProject} icon={Save} label="Save" />
        <label className="inline-flex">
          <ToolBtn as="span" icon={FolderOpen} label="Load" />
          <input type="file" accept=".json" className="hidden" onChange={loadProject} />
        </label>
        <div className="w-px h-5 bg-slate-200 mx-1.5" />
        <ToolBtn onClick={runSim} icon={Play} label="Run" disabled={simState.running} color="text-emerald-600 hover:bg-emerald-50" />
        <ToolBtn onClick={stopSim} icon={Square} label="Stop" disabled={!simState.running} color="text-red-600 hover:bg-red-50" />
        <ToolBtn onClick={resetSim} icon={RotateCcw} label="Reset" color="text-amber-600 hover:bg-amber-50" />
        <div className="w-px h-5 bg-slate-200 mx-1.5" />
        <div className="flex items-center gap-2 text-[11px] text-slate-600">
          <label className="text-slate-500">dt</label>
          <input type="number" value={simState.dt} step={0.1} min={0.1}
                 onChange={e => setSimState(s => ({ ...s, dt: parseFloat(e.target.value) || 1 }))}
                 className="w-14 bg-white border border-slate-300 px-1.5 py-0.5 rounded text-slate-900 font-mono focus:outline-none focus:border-cyan-500" />
          <label className="text-slate-500 ml-2">t_final</label>
          <input type="number" value={simState.t_final} step={10}
                 onChange={e => setSimState(s => ({ ...s, t_final: parseFloat(e.target.value) || 600 }))}
                 className="w-16 bg-white border border-slate-300 px-1.5 py-0.5 rounded text-slate-900 font-mono focus:outline-none focus:border-cyan-500" />
        </div>
        <div className="flex-1" />
        <div className="text-[11px] text-slate-500 font-mono">
          blocks <span className="text-slate-900 font-semibold">{blocks.length}</span>
          <span className="mx-1.5 text-slate-300">·</span>
          conns <span className="text-slate-900 font-semibold">{connections.length}</span>
        </div>
      </div>

      {/* Main 3-panel */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: Type Library */}
        <div className="w-56 bg-white border-r border-slate-200 overflow-y-auto shrink-0">
          <div className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 border-b border-slate-100 bg-slate-50">
            Type Library
          </div>
          {Object.entries(
            Object.entries(TYPES).reduce((acc, [k, v]) => { (acc[v.category] ||= []).push([k, v]); return acc; }, {})
          ).map(([cat, items]) => {
            const catStyle = CATEGORY_STYLES[cat];
            return (
              <div key={cat}>
                <button
                  className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedCats(ec => ({ ...ec, [cat]: !ec[cat] }))}
                >
                  {expandedCats[cat] ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${catStyle.bg} ${catStyle.text} ${catStyle.border} border`}>
                    {catStyle.badge}
                  </span>
                  <span className="text-slate-700">{cat}</span>
                </button>
                {expandedCats[cat] && items.map(([key, def]) => {
                  const Icon = def.icon;
                  return (
                    <div
                      key={key}
                      draggable
                      onDragStart={(e) => handleLibraryDragStart(e, key)}
                      className="flex items-center gap-2 px-3 py-1.5 mx-1.5 my-0.5 rounded cursor-grab hover:bg-slate-50 border border-transparent hover:border-slate-200 active:cursor-grabbing transition-colors"
                      title={def.desc}
                    >
                      <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: def.color + '15' }}>
                        <Icon size={12} style={{ color: def.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-slate-800 truncate">{def.name}</div>
                        <div className="text-[9px] text-slate-400 font-mono">Type {def.typeNo}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div className="px-3 py-4 text-[10px] text-slate-400 border-t border-slate-100 mt-2 leading-relaxed">
            드래그하여 캔버스에 배치하세요
          </div>
        </div>

        {/* Center: Canvas + Bottom plot */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            ref={canvasRef}
            className="flex-1 relative bg-slate-50 overflow-auto"
            style={{
              backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={() => { setDragging(null); setDraggingConn(null); }}
            onClick={() => { setConnecting(null); setSelected(null); setSelectedConn(null); }}
          >
            <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
              {connections.map((c, i) => {
                const fromBlock = blocks.find(b => b.id === c.from.blockId);
                const toBlock = blocks.find(b => b.id === c.to.blockId);
                if (!fromBlock || !toBlock) return null;
                const fromPos = getPortPos(fromBlock, c.from.portKey, 'out');
                const toPos = getPortPos(toBlock, c.to.portKey, 'in');
                if (!fromPos || !toPos) return null;
                const path = getOrthogonalPath(fromPos, toPos, {
                  midOffsetX: c.midOffsetX ?? 0,
                  midOffsetY: c.midOffsetY ?? 0,
                  outOffsetX: c.outOffsetX ?? 0,
                  inOffsetX: c.inOffsetX ?? 0,
                });
                const isHovered = hoveredConn === i;
                const isSelected = selectedConn === i;
                const isDraggingThis = draggingConn?.idx === i;
                const highlight = isSelected || isHovered || isDraggingThis;

                // 삭제 버튼은 첫 번째 핸들 근처에 표시
                const firstHandle = path.handles[0] || { x: 0, y: 0 };

                return (
                  <g
                    key={i}
                    className="pointer-events-auto"
                    onMouseEnter={() => setHoveredConn(i)}
                    onMouseLeave={() => setHoveredConn(h => h === i ? null : h)}
                  >
                    {/* 가시 직교선 */}
                    <path
                      d={path.d}
                      stroke={isSelected ? '#0284c7' : (highlight ? '#0891b2' : '#94a3b8')}
                      strokeWidth={isSelected ? 2.5 : (highlight ? 2 : 1.5)}
                      fill="none"
                      className="transition-colors"
                    />
                    {/* 전체 라인 히트 영역 (클릭 시 연결선 선택) */}
                    <path
                      d={path.d}
                      stroke="transparent"
                      strokeWidth="12"
                      fill="none"
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedConn(i);
                        setSelected(null);
                      }}
                    />

                    {/* 각 세그먼트 편집 핸들 */}
                    {path.handles.map(h => {
                      const isVerticalSeg = h.axis === 'x';
                      const segLength = h.segMax - h.segMin;
                      if (segLength < 4) return null;
                      const isBeingDragged = isDraggingThis && draggingConn?.segment === h.segment;
                      const showActive = isBeingDragged || highlight;
                      const cursor = isVerticalSeg ? 'cursor-ew-resize' : 'cursor-ns-resize';

                      const startDragSeg = (e) => {
                        e.stopPropagation();
                        const rect = canvasRef.current.getBoundingClientRect();
                        const offsetKey = SEGMENT_OFFSET_KEYS[h.segment];
                        setSelectedConn(i);
                        setSelected(null);
                        setDraggingConn({
                          idx: i,
                          segment: h.segment,
                          startMouseX: e.clientX - rect.left,
                          startMouseY: e.clientY - rect.top,
                          startOffset: c[offsetKey] ?? 0,
                        });
                      };

                      const resetSeg = (e) => {
                        e.stopPropagation();
                        const offsetKey = SEGMENT_OFFSET_KEYS[h.segment];
                        setConnections(cs => cs.map((cc, idx) => idx === i ? { ...cc, [offsetKey]: 0 } : cc));
                      };

                      return (
                        <g key={h.segment}>
                          {/* 세그먼트 히트 영역 (길쭉한 투명 rect) */}
                          <rect
                            x={isVerticalSeg ? h.x - 5 : h.segMin}
                            y={isVerticalSeg ? h.segMin : h.y - 5}
                            width={isVerticalSeg ? 10 : segLength}
                            height={isVerticalSeg ? segLength : 10}
                            fill="transparent"
                            className={cursor}
                            onMouseDown={startDragSeg}
                            onDoubleClick={resetSeg}
                          />
                          {/* 시각 핸들 */}
                          <circle
                            cx={h.x}
                            cy={h.y}
                            r={showActive ? 5 : 3}
                            fill="white"
                            stroke={showActive ? '#0891b2' : '#94a3b8'}
                            strokeWidth={2}
                            className={`${cursor} transition-all`}
                            onMouseDown={startDragSeg}
                            onDoubleClick={resetSeg}
                          >
                            <title>{`드래그: ${isVerticalSeg ? '좌우' : '상하'} 이동 · 더블클릭: 리셋`}</title>
                          </circle>
                        </g>
                      );
                    })}

                    {/* 삭제 버튼 (선택 시에만 persistent 표시) */}
                    {isSelected && (
                      <g
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConnections(cs => cs.filter((_, idx) => idx !== i));
                          setSelectedConn(null);
                        }}
                      >
                        {/* 넓은 히트 영역 */}
                        <circle cx={firstHandle.x + 18} cy={firstHandle.y} r={12} fill="transparent" />
                        {/* 실제 버튼 */}
                        <circle cx={firstHandle.x + 18} cy={firstHandle.y} r={9} fill="#ef4444" stroke="white" strokeWidth={2} />
                        <text x={firstHandle.x + 18} y={firstHandle.y + 4} textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" style={{ userSelect: 'none', pointerEvents: 'none' }}>×</text>
                      </g>
                    )}
                  </g>
                );
              })}
              {/* 연결 진행 중 점선 (마우스 따라다님) */}
              {connecting && (() => {
                const block = blocks.find(b => b.id === connecting.blockId);
                if (!block) return null;
                const pos = getPortPos(block, connecting.portKey, connecting.direction);
                if (!pos) return null;
                const target = { x: mousePos.x, y: mousePos.y };
                const path = connecting.direction === 'out'
                  ? getOrthogonalPath(pos, target)
                  : getOrthogonalPath(target, pos);
                return (
                  <path d={path.d} stroke="#0891b2" strokeWidth="1.75" strokeDasharray="4 4" fill="none" />
                );
              })()}
            </svg>

            {blocks.map(block => {
              const def = TYPES[block.type];
              const Icon = def.icon;
              const isSel = selected === block.id;
              const maxPorts = Math.max(def.inputs.length, def.outputs.length);
              const height = Math.max(80, 45 + maxPorts * 20 + 10);
              return (
                <div
                  key={block.id}
                  className={`absolute rounded-md bg-white shadow-sm transition-all ${isSel ? 'ring-2 ring-cyan-500 ring-offset-1 shadow-md' : 'hover:shadow-md'}`}
                  style={{
                    left: block.x, top: block.y, width: 180, height,
                    border: `1px solid ${isSel ? def.color : '#e2e8f0'}`,
                  }}
                  onMouseDown={(e) => handleBlockMouseDown(e, block.id)}
                  onClick={(e) => { e.stopPropagation(); setSelected(block.id); setSelectedConn(null); }}
                >
                  <div className="h-6 px-2 flex items-center gap-1.5 border-b rounded-t-md"
                       style={{ borderColor: def.color + '30', background: def.color + '0d' }}>
                    <Icon size={11} style={{ color: def.color }} />
                    <span className="text-[10px] font-semibold text-slate-800 flex-1 truncate">{block.name}</span>
                    <span className="text-[9px] text-slate-400 font-mono">T{def.typeNo}</span>
                  </div>
                  <div className="relative" style={{ height: height - 24 }}>
                    {def.inputs.map((p, i) => {
                      const isActive = connecting && connecting.blockId === block.id && connecting.portKey === p.key && connecting.direction === 'in';
                      // 원 중심이 block.y + 43 + i*20에 오도록 배치 (getPortPos와 일치)
                      // relative div가 block.y+24부터 시작 → 상대 중심 Y = 19 + i*20
                      // wrapper 높이 16px, items-center로 원(12px) 중심이 wrapper 중앙(8px 지점)에 옴
                      // 따라서 wrapper top = 19+i*20 - 8 = 11+i*20
                      return (
                        <div
                          key={p.key}
                          data-port="in"
                          onClick={(e) => handlePortClick(e, block.id, p.key, 'in')}
                          className={`absolute flex items-center cursor-crosshair rounded transition-colors ${
                            isActive ? 'bg-cyan-100' : 'hover:bg-cyan-50'
                          }`}
                          style={{
                            left: -12,        // 원 중심이 block.x에 오려면: -12(left) + 6(padding) + 6(원 반지름) = 0
                            top: 11 + i * 20,
                            height: 16,
                            paddingLeft: 6,
                            paddingRight: 4,
                          }}
                          title={`${p.label} [${p.unit}]`}
                        >
                          <div
                            className={`w-3 h-3 rounded-full border-2 bg-white shrink-0 pointer-events-none transition-colors ${
                              isActive ? 'bg-cyan-500 border-cyan-600' : 'border-slate-400'
                            }`}
                          />
                          <span className="text-[9px] text-slate-600 ml-1 font-mono leading-none pointer-events-none whitespace-nowrap">{p.label}</span>
                        </div>
                      );
                    })}
                    {def.outputs.map((p, i) => {
                      const isActive = connecting && connecting.blockId === block.id && connecting.portKey === p.key && connecting.direction === 'out';
                      // 거울 배치: 원 중심이 block.x + 180에 오도록
                      return (
                        <div
                          key={p.key}
                          data-port="out"
                          onClick={(e) => handlePortClick(e, block.id, p.key, 'out')}
                          className={`absolute flex items-center flex-row-reverse cursor-crosshair rounded transition-colors ${
                            isActive ? 'bg-amber-100' : 'hover:bg-amber-50'
                          }`}
                          style={{
                            right: -12,
                            top: 11 + i * 20,
                            height: 16,
                            paddingRight: 6,
                            paddingLeft: 4,
                          }}
                          title={`${p.label} [${p.unit}]`}
                        >
                          <div
                            className={`w-3 h-3 rounded-full border-2 bg-white shrink-0 pointer-events-none transition-colors ${
                              isActive ? 'bg-amber-500 border-amber-600' : 'border-slate-400'
                            }`}
                          />
                          <span className="text-[9px] text-slate-600 mr-1 font-mono leading-none pointer-events-none whitespace-nowrap">
                            {p.label}
                            {block.outputs[p.key] !== undefined && (
                              <span className="ml-1 text-amber-700 font-semibold">
                                {typeof block.outputs[p.key] === 'number' ? block.outputs[p.key].toFixed(1) : ''}
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {blocks.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 pointer-events-none">
                <div className="text-center">
                  <div className="text-3xl mb-3 text-slate-300">◇</div>
                  <div className="text-sm text-slate-500">좌측 Type Library에서 컴포넌트를 드래그하세요</div>
                  <div className="text-[11px] mt-1 text-slate-400">Ambient → Fan → Drum → Plotter 순으로 연결해보세요</div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom: Plot + Log */}
          <div className="h-52 bg-white border-t border-slate-200 flex shrink-0">
            <div className="flex-1 p-3 overflow-hidden">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Output Plot</div>
              {plotterData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-[11px]">
                  Plotter 블록을 추가하고 신호를 연결하세요
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="88%">
                  <LineChart data={simState.history}>
                    <CartesianGrid strokeDasharray="2 2" stroke="#e2e8f0" />
                    <XAxis dataKey="t" stroke="#94a3b8" tick={{ fontSize: 10 }} label={{ value: 'time [s]', position: 'insideBottomRight', offset: -5, style: { fill: '#94a3b8', fontSize: 10 } }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: 'white', border: '1px solid #e2e8f0', fontSize: 11, borderRadius: 4 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {plotterData.flatMap(pd => pd.series).map((s, i) => (
                      <Line key={s} type="monotone" dataKey={s}
                            stroke={['#0891b2', '#d97706', '#7c3aed', '#db2777', '#059669'][i % 5]}
                            dot={false} strokeWidth={1.75} isAnimationActive={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="w-64 border-l border-slate-200 p-3 overflow-y-auto bg-slate-50">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Sim Log</div>
              {simState.log.slice(-20).map((l, i) => (
                <div key={i} className="text-[10px] text-slate-600 font-mono leading-tight">{l}</div>
              ))}
              {simState.log.length === 0 && <div className="text-[10px] text-slate-400">No events yet</div>}
            </div>
          </div>
        </div>

        {/* Right: Properties */}
        <div className="w-72 bg-white border-l border-slate-200 overflow-y-auto shrink-0">
          <div className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span>Properties</span>
            {selectedBlock && (
              <button onClick={() => deleteBlock(selectedBlock.id)} className="text-red-500 hover:text-red-600">
                <Trash2 size={12} />
              </button>
            )}
          </div>
          {!selectedBlock ? (
            <div className="p-4 text-slate-400 text-[11px] text-center">블록을 선택하세요</div>
          ) : (
            <div className="p-3 space-y-4">
              <div>
                <div className="text-[10px] text-slate-500 mb-1 font-medium">Name</div>
                <input
                  value={selectedBlock.name}
                  onChange={(e) => updateBlockName(selectedBlock.id, e.target.value)}
                  className="w-full bg-white border border-slate-300 px-2 py-1 rounded text-[11px] text-slate-900 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${CATEGORY_STYLES[selectedDef.category].bg} ${CATEGORY_STYLES[selectedDef.category].text} ${CATEGORY_STYLES[selectedDef.category].border} border`}>
                  {CATEGORY_STYLES[selectedDef.category].badge}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Type {selectedDef.typeNo}</span>
                <span className="text-[10px] text-slate-500">· {selectedDef.name}</span>
              </div>
              <div className="text-[10px] text-slate-500 italic leading-relaxed">{selectedDef.desc}</div>

              {selectedDef.parameters.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1 font-semibold">
                    <Settings size={10} /> Parameters
                  </div>
                  <div className="space-y-1">
                    {selectedDef.parameters.map(p => (
                      <div key={p.key} className="flex items-center gap-2">
                        <label className="flex-1 text-[11px] text-slate-700">{p.label}</label>
                        <input
                          type={typeof p.value === 'number' ? 'number' : 'text'}
                          value={selectedBlock.params[p.key]}
                          step={typeof p.value === 'number' ? (p.value < 1 ? 0.01 : p.value < 10 ? 0.1 : 1) : undefined}
                          onChange={(e) => updateParam(selectedBlock.id, p.key,
                            typeof p.value === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value)}
                          className="w-20 bg-white border border-slate-300 px-1.5 py-0.5 rounded text-[11px] text-slate-900 font-mono text-right focus:outline-none focus:border-cyan-500"
                        />
                        <span className="text-[10px] text-slate-400 w-10 font-mono">{p.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedDef.inputs.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1 font-semibold">
                    <Activity size={10} /> Inputs
                  </div>
                  <div className="space-y-1">
                    {selectedDef.inputs.map(p => {
                      const val = selectedBlock.lastInputs?.[p.key];
                      return (
                        <div key={p.key} className="flex items-center gap-2 text-[11px]">
                          <span className="flex-1 text-slate-700">{p.label}</span>
                          <span className="text-cyan-700 font-semibold font-mono w-16 text-right">
                            {val !== undefined ? (typeof val === 'number' ? val.toFixed(2) : val) : '—'}
                          </span>
                          <span className="text-[10px] text-slate-400 w-10 font-mono">{p.unit}</span>
                        </div>
                      );
                    })}
                    {selectedDef.inputs.some(p => !connections.find(c => c.to.blockId === selectedBlock.id && c.to.portKey === p.key)) && (
                      <div className="text-[9px] text-amber-600 mt-1 flex items-center gap-1">
                        <span>⚠</span> 일부 입력이 연결되지 않음
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedDef.outputs.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1 font-semibold">
                    <Zap size={10} /> Outputs
                  </div>
                  <div className="space-y-1">
                    {selectedDef.outputs.map(p => {
                      const val = selectedBlock.outputs?.[p.key];
                      return (
                        <div key={p.key} className="flex items-center gap-2 text-[11px]">
                          <span className="flex-1 text-slate-700">{p.label}</span>
                          <span className="text-amber-700 font-semibold font-mono w-16 text-right">
                            {val !== undefined ? (typeof val === 'number' ? val.toFixed(2) : val) : '—'}
                          </span>
                          <span className="text-[10px] text-slate-400 w-10 font-mono">{p.unit}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedBlock.state && Object.keys(selectedBlock.state).length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-semibold">State</div>
                  <div className="space-y-1">
                    {Object.entries(selectedBlock.state).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 text-[11px]">
                        <span className="flex-1 text-slate-600">{k}</span>
                        <span className="text-slate-800 font-mono w-16 text-right">
                          {typeof v === 'number' ? v.toFixed(3) : JSON.stringify(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Statusbar */}
      <div className="h-6 bg-slate-50 border-t border-slate-200 flex items-center px-3 text-[10px] text-slate-500 gap-4 shrink-0 font-mono">
        <span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1"></span>
          Connecting: {connecting ? `${blocks.find(b => b.id === connecting.blockId)?.name}.${connecting.portKey} (${connecting.direction})` : 'none'}
        </span>
        <span>({mousePos.x.toFixed(0)}, {mousePos.y.toFixed(0)})</span>
        {selectedConn !== null && (
          <span className="text-sky-600">선택된 연결선 #{selectedConn} · Delete 키로 삭제</span>
        )}
        {selected && selectedConn === null && (
          <span className="text-sky-600">선택된 블록 · Delete 키로 삭제</span>
        )}
        <div className="flex-1" />
        <span>HPWD Simulation Studio · quasi-steady seq. subst.</span>
      </div>
    </div>
  );
}

function ToolBtn({ icon: Icon, label, onClick, disabled, color = 'text-slate-700 hover:bg-slate-100', as }) {
  const Comp = as || 'button';
  return (
    <Comp
      onClick={disabled ? undefined : onClick}
      className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] transition-colors ${color} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <Icon size={13} />
      <span>{label}</span>
    </Comp>
  );
}
