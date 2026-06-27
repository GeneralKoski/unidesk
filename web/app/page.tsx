"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Dropdown,
  Grid,
  Input,
  List,
  Radio,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from "antd";
import type { MenuProps } from "antd";
import {
  AppstoreOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  CalculatorOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  HistoryOutlined,
  LineOutlined,
  PlusOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import type {
  Libretto,
  RigaDaSostenere,
  RigaLibretto,
  TrattoCarriera,
} from "@unidesk/core";
import { getJSON } from "@/lib/api";

function carrieraLabel(t: TrattoCarriera): string {
  return `${t.cdsDes} - ${t.staStuDes}`;
}

const { useBreakpoint } = Grid;

export default function CarrieraPage() {
  const router = useRouter();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [carriere, setCarriere] = useState<TrattoCarriera[]>([]);
  const [matId, setMatId] = useState<number | null>(null);
  const [libretto, setLibretto] = useState<Libretto | null>(null);
  const [daSostenere, setDaSostenere] = useState<RigaDaSostenere[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [librettoLoading, setLibrettoLoading] = useState(false);
  const [dsLoading, setDsLoading] = useState(false);

  // Stati per la visualizzazione dello storico
  const [viewMode, setViewMode] = useState<"dashboard" | "storia" | "simulatore">("dashboard");
  const [sortBy, setSortBy] = useState<"dataRicezione" | "dataEsa">("dataRicezione");
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);

  // Stati per il simulatore della media e proiezioni
  const [mockExams, setMockExams] = useState<Array<{ id: string; adDes: string; peso: number; voto: number | null; lode: boolean }>>([]);
  const [targetGraduationScore, setTargetGraduationScore] = useState<number>(110);
  const [newExamName, setNewExamName] = useState("");
  const [newExamCFU, setNewExamCFU] = useState<number | "">("");
  const [newExamGrade, setNewExamGrade] = useState<number | null | "">("");
  const [newExamLode, setNewExamLode] = useState(false);

  // Carica le carriere una volta e seleziona di default quella attiva
  // (staStuCod "A"); se nessuna è attiva, ripiega sulla prima.
  useEffect(() => {
    getJSON<TrattoCarriera[]>("/api/esse3/carriere")
      .then((c) => {
        setCarriere(c);
        const attiva = c.find((t) => t.staStuCod === "A") ?? c[0];
        setMatId(attiva?.matId ?? null);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setLoading(false));
  }, []);

  // Ricarica libretto e stato prenotazioni a ogni cambio di carriera.
  useEffect(() => {
    if (matId == null) return;
    setLibrettoLoading(true);
    getJSON<Libretto>(`/api/esse3/libretto?matId=${matId}`)
      .then(setLibretto)
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setLibrettoLoading(false));

    // Arricchimento prenotazioni: best-effort, non blocca il resto.
    setDsLoading(true);
    setDaSostenere(null);
    getJSON<RigaDaSostenere[]>(`/api/esse3/da-sostenere?matId=${matId}`)
      .then(setDaSostenere)
      .catch(() => setDaSostenere(null))
      .finally(() => setDsLoading(false));

    // Reset dello storico e simulatore
    setSelectedHistoryIndex(null);
    setViewMode("dashboard");
    setMockExams([]);
  }, [matId]);

  // Helper per estrarre la data dell'esame in base al criterio
  const getExamDate = (r: RigaLibretto, type: "dataRicezione" | "dataEsa") => {
    if (type === "dataRicezione") {
      // Usa dataVerb, dataIns, dataPubb in quest'ordine di preferenza, con fallback su dataEsa
      const esito = r.esito as any;
      return esito.dataVerb || r.dataIns || esito.dataPubb || esito.dataEsa || "";
    }
    return r.esito.dataEsa || "";
  };

  // Helper per fare il parsing della data
  const parseDateString = (dStr: string | undefined): number => {
    if (!dStr) return 0;
    if (/^\d{2}\/\d{2}\/\d{4}/.test(dStr)) {
      const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(dStr);
      return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : 0;
    }
    const parsed = Date.parse(dStr);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Cronologia esami superati ordinata
  const sortedHistory = useMemo(() => {
    if (!libretto?.superate) return [];
    return [...libretto.superate].sort((a, b) => {
      const dateA = parseDateString(getExamDate(a, sortBy));
      const dateB = parseDateString(getExamDate(b, sortBy));
      if (dateA !== dateB) return dateA - dateB;
      return a.adDes.localeCompare(b.adDes);
    });
  }, [libretto?.superate, sortBy]);

  // Calcolo delle statistiche storiche cumulative
  const historyStats = useMemo(() => {
    const statsList: Array<{
      exam: RigaLibretto;
      date: string;
      mediaPonderata: number;
      votoPartenza: number;
      cfuAcquisiti: number;
      esamiSuperati: number;
      impattoMedia: number;
    }> = [];

    let totalVotiPesati = 0;
    let totalCFUConVoto = 0;
    let totalCFU = 0;

    for (let i = 0; i < sortedHistory.length; i++) {
      const exam = sortedHistory[i];
      totalCFU += exam.peso;
      
      const haVoto = exam.esito.voto != null;
      if (haVoto) {
        totalVotiPesati += (exam.esito.voto as number) * exam.peso;
        totalCFUConVoto += exam.peso;
      }

      const mediaPonderata = totalCFUConVoto > 0 ? totalVotiPesati / totalCFUConVoto : 0;
      const votoPartenza = (mediaPonderata / 30) * 110;
      const impattoMedia = i > 0 && haVoto && statsList[i - 1].mediaPonderata > 0
        ? mediaPonderata - statsList[i - 1].mediaPonderata
        : 0;

      statsList.push({
        exam,
        date: getExamDate(exam, sortBy)?.slice(0, 10) || "N/D",
        mediaPonderata,
        votoPartenza,
        cfuAcquisiti: totalCFU,
        esamiSuperati: i + 1,
        impattoMedia,
      });
    }

    return statsList;
  }, [sortedHistory, sortBy]);

  // Calcolo delle statistiche simulate (esami reali superati + esami mock)
  const simulatedStats = useMemo(() => {
    const superateReali = libretto?.superate ?? [];
    const tuttiEsami = [
      ...superateReali.map(r => ({ peso: r.peso, voto: r.esito.voto, lode: r.esito.lode })),
      ...mockExams.map(m => ({ peso: m.peso, voto: m.voto, lode: m.lode }))
    ];
    
    const cfuFatti = tuttiEsami.reduce((sum, r) => sum + r.peso, 0);
    const conVoto = tuttiEsami.filter((r) => r.voto != null);
    const sommaPesata = conVoto.reduce(
      (sum, r) => sum + (r.voto as number) * r.peso,
      0,
    );
    const pesoTot = conVoto.reduce((sum, r) => sum + r.peso, 0);
    const mediaPonderata = pesoTot ? sommaPesata / pesoTot : 0;
    const votoPartenza = (mediaPonderata / 30) * 110;
    
    return {
      cfuFatti,
      mediaPonderata,
      votoPartenza,
      esamiSuperati: tuttiEsami.length,
    };
  }, [libretto?.superate, mockExams]);

  // Proiezioni di laurea
  const targetProjections = useMemo(() => {
    if (!libretto?.stats) return null;
    
    const realCfu = libretto.stats.cfuFatti;
    const realMedia = libretto.stats.mediaPonderata;
    const remainingCfu = libretto.stats.cfuRimasti;
    
    // Includiamo anche gli esami simulati nel conteggio dei CFU fatti e rimanenti!
    const mockCfu = mockExams.reduce((sum, r) => sum + r.peso, 0);
    
    // Ricalcoliamo i rimanenti detraendo quelli simulati
    const effectiveRemainingCfu = Math.max(0, remainingCfu - mockCfu);
    const effectiveRealCfu = realCfu + mockCfu;
    const effectiveRealMedia = simulatedStats.mediaPonderata;
    
    if (effectiveRemainingCfu <= 0) {
      return { achievable: true, message: "Obiettivo raggiunto! Hai simulato il completamento di tutti i CFU rimanenti." };
    }
    
    const targetAvg = (targetGraduationScore * 30) / 110;
    const totalCfu = effectiveRealCfu + effectiveRemainingCfu;
    
    // Formula per la media necessaria
    const neededAvg = ((targetAvg * totalCfu) - (effectiveRealMedia * effectiveRealCfu)) / effectiveRemainingCfu;
    
    if (neededAvg <= 18) {
      return { 
        achievable: true, 
        neededAvg, 
        message: `Obiettivo garantito! Ti basta mantenere una media ponderata di 18.00 (o idoneità) nei restanti ${effectiveRemainingCfu} CFU.`
      };
    }
    if (neededAvg > 30) {
      return { 
        achievable: false, 
        neededAvg, 
        message: `Obiettivo non raggiungibile matematicamente. Richiederebbe una media ponderata di ${neededAvg.toFixed(2)} nei restanti ${effectiveRemainingCfu} CFU.`
      };
    }
    return {
      achievable: true,
      neededAvg,
      message: `Raggiungibile mantenendo una media ponderata di ${neededAvg.toFixed(2)} nei restanti ${effectiveRemainingCfu} CFU.`
    };
  }, [libretto?.stats, targetGraduationScore, mockExams, simulatedStats]);

  // Distribuzione dei voti reali
  const gradeDistribution = useMemo(() => {
    if (!libretto?.superate) return { data: [], maxCount: 0 };
    
    const distribution: Record<string, number> = {};
    for (let g = 18; g <= 30; g++) {
      distribution[String(g)] = 0;
    }
    distribution["30L"] = 0;
    
    let maxCount = 0;
    libretto.superate.forEach(r => {
      if (r.esito.voto != null) {
        let key = String(r.esito.voto);
        if (r.esito.voto === 30 && r.esito.lode) {
          key = "30L";
        }
        distribution[key] = (distribution[key] || 0) + 1;
        if (distribution[key] > maxCount) {
          maxCount = distribution[key];
        }
      }
    });
    
    return {
      data: Object.entries(distribution).map(([grade, count]) => ({ grade, count })),
      maxCount
    };
  }, [libretto?.superate]);

  if (loading)
    return <Spin size="large" style={{ display: "block", marginTop: 80 }} />;

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="Impossibile leggere Esse3"
        description={`${error}. Prova a ricaricare la pagina o a rifare il login.`}
      />
    );
  }

  const sel = carriere.find((t) => t.matId === matId);
  const s = libretto?.stats;

  const handleAddMockExam = () => {
    if (newExamCFU === "") return;
    const newExam = {
      id: Math.random().toString(36).substring(2, 9),
      adDes: newExamName.trim() || `Esame Ipotetico ${mockExams.length + 1}`,
      peso: Number(newExamCFU),
      voto: newExamGrade === "" ? null : newExamGrade,
      lode: newExamLode
    };
    setMockExams([...mockExams, newExam]);
    setNewExamName("");
    setNewExamCFU("");
    setNewExamGrade("");
    setNewExamLode(false);
  };

  const handleRemoveMockExam = (id: string) => {
    setMockExams(mockExams.filter(exam => exam.id !== id));
  };



  // Statistiche correnti, storiche o simulate
  const isHistoryActive = viewMode === "storia" && selectedHistoryIndex !== null;
  const isSimulatoreActive = viewMode === "simulatore";
  const currentStats = isHistoryActive && historyStats[selectedHistoryIndex ?? 0]
    ? {
        mediaPonderata: historyStats[selectedHistoryIndex ?? 0].mediaPonderata,
        votoPartenza: historyStats[selectedHistoryIndex ?? 0].votoPartenza,
        cfuFatti: historyStats[selectedHistoryIndex ?? 0].cfuAcquisiti,
        esamiSuperati: historyStats[selectedHistoryIndex ?? 0].esamiSuperati,
      }
    : isSimulatoreActive
    ? {
        mediaPonderata: simulatedStats.mediaPonderata,
        votoPartenza: simulatedStats.votoPartenza,
        cfuFatti: simulatedStats.cfuFatti,
        esamiSuperati: simulatedStats.esamiSuperati,
      }
    : {
        mediaPonderata: s?.mediaPonderata ?? 0,
        votoPartenza: s?.mediaPonderata ? (s.mediaPonderata / 30) * 110 : 0,
        cfuFatti: s?.cfuFatti ?? 0,
        esamiSuperati: s?.esamiSuperati ?? 0,
      };

  const dsRows: RigaDaSostenere[] =
    daSostenere ??
    ((libretto?.daFare ?? []).map((r) => ({
      ...r,
      prenotazione: {
        stato: "nessuno",
        prenotabili: 0,
        dataPrenotazione: null,
        dataAppello: null,
      },
    })) as RigaDaSostenere[]);

  const availableDaSostenere = dsRows.filter(
    (ds) => !mockExams.some((me) => me.adDes === ds.adDes)
  );

  const goToEsame = (r: RigaDaSostenere) => {
    const k = r.chiaveADContestualizzata;
    const q = new URLSearchParams({
      matId: String(matId),
      cdsId: String(k.cdsId),
      adsceId: String(r.adsceId),
      stuId: String(r.stuId),
      n: r.adDes,
    });
    router.push(`/esami/${k.adId}?${q.toString()}`);
  };

  const tipoTag = (t: string) =>
    /opzion/i.test(t) ? (
      <Tag color="purple">A scelta</Tag>
    ) : (
      <Tag>Obbligatorio</Tag>
    );

  const prenTag = (r: RigaDaSostenere) =>
    r.numPrenotazioni > 0 ? (
      <Tag color="blue">Prenotato</Tag>
    ) : r.prenotazione?.stato === "esterno" ? (
      <Tag color="orange">Su Esse3</Tag>
    ) : r.prenotazione?.prenotabili > 0 ? (
      <Tag color="gold">
        {r.prenotazione.prenotabili}{" "}
        {r.prenotazione.prenotabili === 1 ? "prenotabile" : "prenotabili"}
      </Tag>
    ) : (
      <Tag>Nessun appello</Tag>
    );

  const columns = [
    { title: "Insegnamento", dataIndex: "adDes", key: "adDes" },
    { title: "CFU", dataIndex: "peso", key: "peso", width: 70 },
    {
      title: "Tipo",
      dataIndex: "tipoInsDes",
      key: "tipoInsDes",
      width: 130,
      render: (t: string) =>
        /opzion/i.test(t) ? (
          <Tag color="purple">A scelta</Tag>
        ) : (
          <Tag>Obbligatorio</Tag>
        ),
    },
  ];

  const colSuperate = [
    ...columns,
    {
      title: "Voto",
      key: "voto",
      width: 90,
      render: (_: unknown, r: RigaLibretto) =>
        r.esito.voto != null ? (
          <Tag color="green">
            {r.esito.voto}
            {r.esito.lode ? "L" : ""}
          </Tag>
        ) : (
          <Tag>Idoneo</Tag>
        ),
    },
    {
      title: "Data",
      key: "data",
      width: 120,
      render: (_: unknown, r: RigaLibretto) =>
        r.esito.dataEsa?.slice(0, 10) ?? "-",
    },
  ];

  const colDaFare = [
    ...columns,
    {
      title: "Prenotazione",
      key: "pren",
      width: 180,
      render: (_: unknown, r: RigaDaSostenere) =>
        r.numPrenotazioni > 0 ? (
          <Tag color="blue">Prenotato</Tag>
        ) : r.prenotazione?.stato === "esterno" ? (
          <Tag color="orange">Su Esse3</Tag>
        ) : r.prenotazione?.prenotabili > 0 ? (
          <Tag color="gold">
            {r.prenotazione.prenotabili}{" "}
            {r.prenotazione.prenotabili === 1 ? "prenotabile" : "prenotabili"}
          </Tag>
        ) : (
          <Tag>Nessun appello</Tag>
        ),
    },
    {
      title: "Appello",
      key: "appello",
      width: 120,
      render: (_: unknown, r: RigaDaSostenere) =>
        r.prenotazione?.dataAppello ? (
          r.prenotazione.dataAppello.slice(0, 10)
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        ),
    },
  ];

  // Render grafico SVG dell'andamento della media
  const renderSVGChart = () => {
    if (historyStats.length < 2) {
      return (
        <div style={{ padding: 24, textAlign: "center", color: "rgba(0, 0, 0, 0.45)" }}>
          Dati insufficienti per generare il grafico dell'andamento della media.
        </div>
      );
    }

    const paddingX = 45;
    const paddingY = 40; // Spazio per le date sull'asse X
    const chartHeight = 220;
    const chartWidth = 500;

    const maxVal = 30;
    const minVal = 18;

    const points = historyStats.map((item, idx) => {
      const x = paddingX + (idx / (historyStats.length - 1)) * (chartWidth - paddingX - 20);
      const y = chartHeight - paddingY - ((item.mediaPonderata - minVal) / (maxVal - minVal)) * (chartHeight - paddingY - 15);
      return { x, y, val: item.mediaPonderata, name: item.exam.adDes, idx };
    });

    const selectedIdx = selectedHistoryIndex !== null ? selectedHistoryIndex : points.length - 1;

    // Linea attiva (fino all'esame selezionato)
    let activePathD = "";
    if (points.length > 0) {
      activePathD = `M ${points[0].x} ${points[0].y} `;
      for (let i = 1; i <= selectedIdx; i++) {
        activePathD += `L ${points[i].x} ${points[i].y} `;
      }
    }

    // Linea inattiva/futura (dopo l'esame selezionato)
    let inactivePathD = "";
    if (selectedHistoryIndex !== null && selectedHistoryIndex < points.length - 1) {
      inactivePathD = `M ${points[selectedHistoryIndex].x} ${points[selectedHistoryIndex].y} `;
      for (let i = selectedHistoryIndex + 1; i < points.length; i++) {
        inactivePathD += `L ${points[i].x} ${points[i].y} `;
      }
    }

    // Area attiva sfumata sotto la linea
    const activeAreaD = activePathD 
      ? `${activePathD} L ${points[selectedIdx].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`
      : "";

    // Calcolo degli indici per visualizzare le date sull'asse X (inizio, metà, fine)
    const labelIndices: number[] = [];
    if (points.length >= 1) labelIndices.push(0);
    if (points.length >= 3) {
      const mid = Math.floor(points.length / 2);
      if (mid !== 0 && mid !== points.length - 1) {
        labelIndices.push(mid);
      }
    }
    if (points.length >= 2) labelIndices.push(points.length - 1);

    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: "100%", height: "auto", display: "block" }}>
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1890ff" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#1890ff" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#1890ff" />
              <stop offset="100%" stopColor="#52c41a" />
            </linearGradient>
          </defs>

          {/* Griglia orizzontale e Label Y */}
          {[18, 20, 22, 24, 26, 28, 30].map((val) => {
            const y = chartHeight - paddingY - ((val - minVal) / (maxVal - minVal)) * (chartHeight - paddingY - 15);
            return (
              <g key={val}>
                <line 
                  x1={paddingX} 
                  y1={y} 
                  x2={chartWidth - 20} 
                  y2={y} 
                  stroke="#f0f0f0" 
                  strokeDasharray="4 4" 
                />
                <text 
                  x={paddingX - 8} 
                  y={y + 4} 
                  textAnchor="end" 
                  fontSize="10" 
                  fill="rgba(0,0,0,0.45)"
                  fontFamily="sans-serif"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area sfumata sotto la linea attiva */}
          {activeAreaD && <path d={activeAreaD} fill="url(#chartGrad)" />}

          {/* Linea attiva (passata) */}
          {activePathD && (
            <path 
              d={activePathD} 
              fill="none" 
              stroke="url(#lineGrad)" 
              strokeWidth="2.5" 
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Linea inattiva (futura) */}
          {inactivePathD && (
            <path 
              d={inactivePathD} 
              fill="none" 
              stroke="#bfbfbf" 
              strokeWidth="1.5" 
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Date sull'asse X */}
          {labelIndices.map((idx) => {
            const pt = points[idx];
            const dateStr = historyStats[idx].date;
            return (
              <g key={`lbl-x-${idx}`}>
                <line 
                  x1={pt.x} 
                  y1={chartHeight - paddingY} 
                  x2={pt.x} 
                  y2={chartHeight - paddingY + 4} 
                  stroke="#bfbfbf" 
                  strokeWidth="1" 
                />
                <text
                  x={pt.x}
                  y={chartHeight - paddingY + 16}
                  textAnchor={idx === 0 ? "start" : idx === points.length - 1 ? "end" : "middle"}
                  fontSize="9"
                  fill="rgba(0,0,0,0.45)"
                  fontFamily="sans-serif"
                >
                  {dateStr}
                </text>
              </g>
            );
          })}

          {/* Punti interattivi */}
          {points.map((pt) => {
            const isSelected = selectedHistoryIndex === pt.idx;
            const isPast = selectedHistoryIndex === null || pt.idx <= selectedIdx;
            
            return (
              <g key={pt.idx} style={{ cursor: "pointer" }} onClick={() => setSelectedHistoryIndex(pt.idx)}>
                <Tooltip title={`${pt.name}: ${pt.val.toFixed(2)} (${historyStats[pt.idx].date})`}>
                  <circle 
                    cx={pt.x} 
                    cy={pt.y} 
                    r={isSelected ? 6 : 4} 
                    fill={isSelected ? "#fff" : isPast ? "#1890ff" : "#f0f0f0"} 
                    stroke={isSelected ? "#1890ff" : isPast ? "#fff" : "#bfbfbf"}
                    strokeWidth={isSelected ? 3 : 1.5}
                    style={{ transition: "all 0.2s" }}
                  />
                  {/* Cerchio invisibile più grande per facilitare il click */}
                  <circle 
                    cx={pt.x} 
                    cy={pt.y} 
                    r={12} 
                    fill="transparent" 
                  />
                </Tooltip>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  // Render grafico SVG dell'istogramma di distribuzione voti
  const renderSVGHistogram = () => {
    const { data, maxCount } = gradeDistribution;
    if (data.length === 0 || maxCount === 0) {
      return (
        <div style={{ padding: 24, textAlign: "center", color: "rgba(0, 0, 0, 0.45)" }}>
          Nessun esame superato con voto per calcolare la distribuzione.
        </div>
      );
    }
    
    const paddingX = 30;
    const paddingY = 20;
    const chartHeight = 150;
    const chartWidth = 500;
    
    const barWidth = (chartWidth - paddingX - 10) / data.length;
    
    return (
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: "100%", height: "auto" }}>
        {/* Griglia orizzontale e assi */}
        <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - 10} y2={chartHeight - paddingY} stroke="#bfbfbf" strokeWidth="1" />
        
        {/* Barre */}
        {data.map((item, idx) => {
          const barHeight = maxCount > 0 ? (item.count / maxCount) * (chartHeight - paddingY - 15) : 0;
          const x = paddingX + idx * barWidth + 2;
          const y = chartHeight - paddingY - barHeight;
          const w = barWidth - 4;
          
          return (
            <g key={item.grade}>
              <Tooltip title={`${item.count} ${item.count === 1 ? "esame" : "esami"} con ${item.grade}`}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={barHeight}
                  fill={item.grade === "30L" ? "#52c41a" : item.grade === "30" ? "#1890ff" : "#36cfc9"}
                  rx="2"
                  style={{ transition: "all 0.3s" }}
                />
              </Tooltip>
              {item.count > 0 && (
                <text
                  x={x + w / 2}
                  y={y - 4}
                  textAnchor="middle"
                  fontSize="9"
                  fill="rgba(0,0,0,0.65)"
                  fontFamily="sans-serif"
                >
                  {item.count}
                </text>
              )}
              <text
                x={x + w / 2}
                y={chartHeight - paddingY + 12}
                textAnchor="middle"
                fontSize="9"
                fill="rgba(0,0,0,0.45)"
                fontFamily="sans-serif"
              >
                {item.grade}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div>
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography.Title level={3} style={{ margin: 0 }}>
          {sel ? sel.cdsDes : "Carriera"}
          {sel && (
            <Tag
              color={sel.staStuCod === "A" ? "green" : "default"}
              style={{ marginLeft: 12 }}
            >
              {sel.staStuDes}
            </Tag>
          )}
        </Typography.Title>
        <Space size={12} wrap className="no-print">
          <Segmented
            options={[
              { label: "Dashboard", value: "dashboard", icon: <AppstoreOutlined /> },
              { label: "Storia", value: "storia", icon: <HistoryOutlined /> },
              { label: "Simulatore", value: "simulatore", icon: <CalculatorOutlined /> },
            ]}
            value={viewMode}
            onChange={(val) => {
              setViewMode(val as "dashboard" | "storia" | "simulatore");
              if (val === "dashboard") setSelectedHistoryIndex(null);
            }}
          />
          {carriere.length > 1 && (
            <Select
              value={matId ?? undefined}
              onChange={setMatId}
              style={{ width: "100%", minWidth: 200, maxWidth: 320 }}
              options={carriere.map((t) => ({
                value: t.matId,
                label: carrieraLabel(t),
              }))}
            />
          )}
        </Space>
      </div>

      {isHistoryActive && historyStats[selectedHistoryIndex ?? 0] && (
        <Alert
          type="info"
          showIcon
          icon={<HistoryOutlined />}
          message={
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span>
                Visualizzazione dello storico dopo l'esame <strong>{historyStats[selectedHistoryIndex ?? 0].exam.adDes}</strong> del {historyStats[selectedHistoryIndex ?? 0].date}.
              </span>
              <Button size="small" type="primary" onClick={() => setSelectedHistoryIndex(null)}>
                Ripristina stato attuale
              </Button>
            </div>
          }
          style={{ marginBottom: 24 }}
          className="no-print"
        />
      )}

      {isSimulatoreActive && (
        <Alert
          type="warning"
          showIcon
          icon={<CalculatorOutlined />}
          message={
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span>
                <strong>Modalità Simulatore Attiva</strong>: le statistiche includono gli esami simulati inseriti.
              </span>
              <Button size="small" onClick={() => setMockExams([])} disabled={mockExams.length === 0}>
                Svuota simulatore
              </Button>
            </div>
          }
          style={{ marginBottom: 24 }}
          className="no-print"
        />
      )}

      <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card 
            style={{ 
              height: "100%", 
              borderColor: isHistoryActive ? "#1890ff" : isSimulatoreActive ? "#722ed1" : undefined, 
              boxShadow: isHistoryActive ? "0 0 8px rgba(24, 144, 255, 0.15)" : isSimulatoreActive ? "0 0 8px rgba(114, 46, 209, 0.15)" : undefined,
              transition: "all 0.3s"
            }}
          >
            <Statistic
              title={
                <span>
                  Media ponderata {isSimulatoreActive && <Tag color="purple" style={{ marginLeft: 6 }}>Simulato</Tag>}
                </span>
              }
              value={currentStats.mediaPonderata}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card 
            style={{ 
              height: "100%", 
              borderColor: isHistoryActive ? "#1890ff" : isSimulatoreActive ? "#722ed1" : undefined,
              boxShadow: isHistoryActive ? "0 0 8px rgba(24, 144, 255, 0.15)" : isSimulatoreActive ? "0 0 8px rgba(114, 46, 209, 0.15)" : undefined,
              transition: "all 0.3s"
            }}
          >
            <Statistic
              title={
                <span>
                  Voto di partenza {isSimulatoreActive && <Tag color="purple" style={{ marginLeft: 6 }}>Simulato</Tag>}
                </span>
              }
              value={currentStats.mediaPonderata ? (currentStats.mediaPonderata / 30) * 110 : 0}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card 
            style={{ 
              height: "100%", 
              borderColor: isHistoryActive ? "#1890ff" : isSimulatoreActive ? "#722ed1" : undefined,
              boxShadow: isHistoryActive ? "0 0 8px rgba(24, 144, 255, 0.15)" : isSimulatoreActive ? "0 0 8px rgba(114, 46, 209, 0.15)" : undefined,
              transition: "all 0.3s"
            }}
          >
            <Statistic 
              title={
                <span>
                  CFU acquisiti {isSimulatoreActive && <Tag color="purple" style={{ marginLeft: 6 }}>Simulato</Tag>}
                </span>
              } 
              value={currentStats.cfuFatti} 
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card 
            style={{ 
              height: "100%", 
              borderColor: isHistoryActive ? "#1890ff" : isSimulatoreActive ? "#722ed1" : undefined,
              boxShadow: isHistoryActive ? "0 0 8px rgba(24, 144, 255, 0.15)" : isSimulatoreActive ? "0 0 8px rgba(114, 46, 209, 0.15)" : undefined,
              transition: "all 0.3s"
            }}
          >
            <Statistic
              title={
                <span>
                  Esami superati {isSimulatoreActive && <Tag color="purple" style={{ marginLeft: 6 }}>Simulato</Tag>}
                </span>
              }
              value={currentStats.esamiSuperati}
              suffix={`/ ${(s?.esamiSuperati ?? 0) + (s?.esamiDaFare ?? 0)}`}
            />
          </Card>
        </Col>
      </Row>

      {viewMode === "simulatore" ? (
        <Row gutter={[24, 24]} className="no-print">
          {/* Colonna Sinistra: Esami Simulati */}
          <Col xs={24} lg={12}>
            <Card title="Simulatore Esami Ipotetici">
              {/* Form d'inserimento rapido */}
              <div style={{ marginBottom: 20, padding: 12, background: "#f9f9f9", borderRadius: 8, border: "1px dashed #d9d9d9" }}>
                <Typography.Text strong style={{ display: "block", marginBottom: 12 }}>
                  Aggiungi esame ipotetico per simulare la media:
                </Typography.Text>
                <Row gutter={[8, 8]} align="middle">
                  <Col xs={24} sm={10}>
                    <Select
                      style={{ width: "100%" }}
                      placeholder="Seleziona esame da sostenere"
                      value={newExamName || undefined}
                      onChange={val => {
                        const selectedExam = availableDaSostenere.find(x => x.adDes === val);
                        if (selectedExam) {
                          setNewExamName(selectedExam.adDes);
                          setNewExamCFU(selectedExam.peso);
                        }
                      }}
                      options={availableDaSostenere.map(ds => ({
                        value: ds.adDes,
                        label: `${ds.adDes} (${ds.peso} CFU)`
                      }))}
                    />
                  </Col>
                  <Col xs={12} sm={4}>
                    <Select
                      style={{ width: "100%" }}
                      placeholder="CFU"
                      disabled={true}
                      value={newExamCFU || undefined}
                      onChange={val => setNewExamCFU(val)}
                      options={[3, 6, 9, 12, 15].map(v => ({ value: v, label: `${v} CFU` }))}
                    />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Select
                      style={{ width: "100%" }}
                      placeholder="Voto"
                      value={newExamGrade === "" ? undefined : newExamGrade}
                      onChange={val => {
                        setNewExamGrade(val === undefined ? "" : val);
                        if (val !== 30) setNewExamLode(false);
                      }}
                      options={[
                        ...Array.from({ length: 13 }, (_, i) => 18 + i).map(v => ({ value: v, label: String(v) })),
                        { value: null as any, label: "Idoneo" }
                      ]}
                    />
                  </Col>
                  <Col xs={12} sm={4} style={{ display: 'flex', justifyContent: 'center' }}>
                    <Radio.Group 
                      disabled={newExamGrade !== 30}
                      value={newExamLode ? "L" : ""}
                      onChange={e => setNewExamLode(e.target.value === "L")}
                    >
                      <Radio.Button value="L">Lode</Radio.Button>
                    </Radio.Group>
                  </Col>
                  <Col xs={24} style={{ textAlign: 'right', marginTop: 8 }}>
                    <Button 
                      type="primary" 
                      icon={<PlusOutlined />} 
                      onClick={handleAddMockExam}
                      disabled={newExamCFU === ""}
                    >
                      Aggiungi Esame
                    </Button>
                  </Col>
                </Row>
              </div>

              {/* Lista esami simulati */}
              {mockExams.length === 0 ? (
                <div style={{ textAlign: "center", color: "rgba(0, 0, 0, 0.45)", padding: "24px 0" }}>
                  Nessun esame simulato aggiunto. Usa il form sopra per aggiungere esami.
                </div>
              ) : (
                <div style={{ maxHeight: "40vh", overflowY: "auto" }}>
                  <List
                    dataSource={mockExams}
                    renderItem={item => (
                      <List.Item
                        actions={[
                          <Button 
                            key="delete" 
                            type="text" 
                            danger 
                            icon={<DeleteOutlined />} 
                            onClick={() => handleRemoveMockExam(item.id)} 
                          />
                        ]}
                      >
                        <List.Item.Meta
                          title={item.adDes}
                          description={
                            <Space split="•">
                              <span>{item.peso} CFU</span>
                              <span>{item.voto !== null ? `${item.voto}${item.lode ? " e Lode" : ""}` : "Idoneo"}</span>
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </div>
              )}
            </Card>
          </Col>

          {/* Colonna Destra: Proiezioni & Distribuzione */}
          <Col xs={24} lg={12}>
            <Row gutter={[16, 16]}>
              {/* Proiezioni di Laurea */}
              <Col xs={24}>
                <Card title="Proiezioni Laurea (CFU Rimanenti)">
                  <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
                    <Typography.Text>Voto laurea desiderato:</Typography.Text>
                    <Select
                      style={{ width: 100 }}
                      value={targetGraduationScore}
                      onChange={val => setTargetGraduationScore(val)}
                      options={Array.from({ length: 45 }, (_, i) => 66 + i).reverse().map(v => ({ value: v, label: String(v) }))}
                    />
                  </div>
                  
                  {targetProjections ? (
                    <Alert
                      type={targetProjections.achievable ? "success" : "warning"}
                      showIcon
                      message="Proiezione per i CFU rimanenti"
                      description={targetProjections.message}
                    />
                  ) : (
                    <div style={{ color: "rgba(0, 0, 0, 0.45)" }}>Impossibile calcolare la proiezione (nessun CFU rimanente).</div>
                  )}
                </Card>
              </Col>

              {/* Distribuzione Voti */}
              <Col xs={24}>
                <Card title="Distribuzione Voti Superati (Reali)">
                  {renderSVGHistogram()}
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      ) : viewMode === "storia" ? (
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={10}>
            <Card 
              title="Linea Temporale Esami" 
            >
              {historyStats.length === 0 ? (
                <div style={{ textAlign: "center", color: "rgba(0, 0, 0, 0.45)", padding: 24 }}>
                  Nessun esame superato registrato.
                </div>
              ) : (
                <div style={{ maxHeight: "65vh", overflowY: "auto", paddingRight: 8, paddingLeft: 8, paddingTop: 8 }}>
                  <Timeline
                    mode="left"
                    items={historyStats
                      .map((item, idx) => ({ ...item, originalIdx: idx }))
                      .reverse()
                      .map((item) => {
                        const idx = item.originalIdx;
                        const isSelected = selectedHistoryIndex === idx;
                      const voto = item.exam.esito.voto;
                      const lode = item.exam.esito.lode;
                      
                      let color = "#d9d9d9";
                      if (voto !== null) {
                        if (voto >= 28) color = "#52c41a";
                        else if (voto >= 24) color = "#1890ff";
                        else color = "#fa8c16";
                      } else {
                        color = "#722ed1";
                      }

                      const dotStyle: React.CSSProperties = isSelected
                        ? {
                            background: color,
                            border: `3px solid ${color}`,
                            boxShadow: `0 0 0 4px ${color}40`,
                            width: 14,
                            height: 14,
                            marginLeft: -1,
                            transform: "scale(1.2)",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }
                        : {
                            background: "#fff",
                            border: `3px solid ${color}`,
                            width: 10,
                            height: 10,
                            cursor: "pointer",
                            transition: "all 0.2s"
                          };

                      const labelContent = (
                        <div 
                          onClick={() => setSelectedHistoryIndex(idx)}
                          style={{ 
                            cursor: "pointer", 
                            padding: "8px 12px", 
                            borderRadius: 8, 
                            background: isSelected ? "#f0f5ff" : "transparent",
                            border: isSelected ? "1px solid #adc6ff" : "1px solid transparent",
                            transition: "all 0.2s",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <Typography.Text strong style={{ color: isSelected ? "#1d39c4" : "inherit" }}>
                              {item.exam.adDes}
                            </Typography.Text>
                            <Tag color={voto != null ? (voto >= 28 ? "green" : voto >= 24 ? "blue" : "orange") : "purple"}>
                              {voto != null ? `${voto}${lode ? "L" : ""}` : "Idoneo"}
                            </Tag>
                          </div>
                          <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 12, color: "rgba(0, 0, 0, 0.45)" }}>
                            <span>{item.exam.peso} CFU</span>
                            <span>•</span>
                            <span>{item.date}</span>
                          </div>
                        </div>
                      );

                      return {
                        dot: <div style={dotStyle} onClick={() => setSelectedHistoryIndex(idx)} />,
                        children: labelContent,
                      };
                    })}
                  />
                </div>
              )}
            </Card>
          </Col>
          
          <Col xs={24} lg={14}>
            <Row gutter={[16, 16]}>
              <Col xs={24}>
                <Card title="Andamento Media Ponderata">
                  {renderSVGChart()}
                </Card>
              </Col>
              
              <Col xs={24}>
                <Card title="Dettaglio Impatto Storico">
                  {selectedHistoryIndex !== null && historyStats[selectedHistoryIndex] ? (
                    (() => {
                      const item = historyStats[selectedHistoryIndex];
                      const impact = item.impattoMedia;
                      const hasImpact = item.exam.esito.voto != null && selectedHistoryIndex > 0;
                      
                      return (
                        <div>
                          <Typography.Title level={4} style={{ marginTop: 0 }}>
                            {item.exam.adDes}
                          </Typography.Title>
                          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                            <Col xs={12} sm={6}>
                              <Statistic title="Voto" value={item.exam.esito.voto != null ? `${item.exam.esito.voto}${item.exam.esito.lode ? "L" : ""}` : "Idoneo"} />
                            </Col>
                            <Col xs={12} sm={6}>
                              <Statistic title="CFU" value={item.exam.peso} />
                            </Col>
                            <Col xs={12} sm={6}>
                              <Statistic 
                                title="Nuova Media" 
                                value={item.mediaPonderata} 
                                precision={2} 
                              />
                            </Col>
                            <Col xs={12} sm={6}>
                              {hasImpact ? (
                                <Statistic 
                                  title="Impatto sulla Media" 
                                  value={impact} 
                                  precision={2}
                                  valueStyle={{ color: impact > 0 ? '#3f8600' : impact < 0 ? '#cf1322' : 'inherit' }}
                                  prefix={impact > 0 ? <ArrowUpOutlined /> : impact < 0 ? <ArrowDownOutlined /> : <LineOutlined />}
                                />
                              ) : (
                                <Statistic title="Impatto sulla Media" value="N/D" />
                              )}
                            </Col>
                          </Row>
                          <Divider style={{ margin: "16px 0" }} />
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Typography.Text type="secondary">
                              Registrato il: {item.date}
                            </Typography.Text>
                            <Button type="link" size="small" onClick={() => setSelectedHistoryIndex(null)}>
                              Torna a stato attuale
                            </Button>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{ textAlign: "center", color: "rgba(0, 0, 0, 0.45)", padding: 24 }}>
                      Seleziona un esame nella timeline o nel grafico per visualizzare l'impatto dettagliato sulla tua carriera.
                    </div>
                  )}
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      ) : (
        <>
          <Card title="Esami superati" style={{ marginBottom: 24 }}>
            {isMobile ? (
              <List
                loading={librettoLoading}
                dataSource={libretto?.superate ?? []}
                rowKey={(r) => r.chiaveADContestualizzata.adId}
                renderItem={(r) => (
                  <List.Item>
                    <div style={{ width: "100%" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 8,
                        }}
                      >
                        <Typography.Text strong>{r.adDes}</Typography.Text>
                        <Tag
                          color={r.esito.voto != null ? "green" : undefined}
                          style={{ marginRight: 0, flexShrink: 0 }}
                        >
                          {r.esito.voto != null
                            ? `${r.esito.voto}${r.esito.lode ? "L" : ""}`
                            : "Idoneo"}
                        </Tag>
                      </div>
                      <Space size={[8, 4]} wrap style={{ marginTop: 6 }}>
                        <Typography.Text type="secondary">
                          {r.peso} CFU
                        </Typography.Text>
                        {tipoTag(r.tipoInsDes)}
                        <Typography.Text type="secondary">
                          {r.esito.dataEsa?.slice(0, 10) ?? "-"}
                        </Typography.Text>
                      </Space>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Table
                rowKey={(r) => r.chiaveADContestualizzata.adId}
                dataSource={libretto?.superate ?? []}
                columns={colSuperate}
                pagination={false}
                size="small"
                scroll={{ x: "max-content" }}
                loading={librettoLoading}
              />
            )}
          </Card>

          <Card title="Da sostenere">
            {isMobile ? (
              <List
                loading={librettoLoading || dsLoading}
                dataSource={dsRows}
                rowKey={(r) => r.chiaveADContestualizzata.adId}
                renderItem={(r) => (
                  <List.Item
                    onClick={() => goToEsame(r)}
                    style={{ cursor: "pointer" }}
                  >
                    <div style={{ width: "100%" }}>
                      <Typography.Text strong>{r.adDes}</Typography.Text>
                      <Space size={[8, 4]} wrap style={{ marginTop: 6 }}>
                        <Typography.Text type="secondary">
                          {r.peso} CFU
                        </Typography.Text>
                        {tipoTag(r.tipoInsDes)}
                        {prenTag(r)}
                        {r.prenotazione?.dataAppello && (
                          <Typography.Text type="secondary">
                            {r.prenotazione.dataAppello.slice(0, 10)}
                          </Typography.Text>
                        )}
                      </Space>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Table
                rowKey={(r) => r.chiaveADContestualizzata.adId}
                dataSource={dsRows}
                columns={colDaFare}
                pagination={false}
                size="small"
                scroll={{ x: "max-content" }}
                loading={librettoLoading || dsLoading}
                onRow={(r) => ({
                  style: { cursor: "pointer" },
                  onClick: () => goToEsame(r),
                })}
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
