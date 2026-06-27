"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Grid,
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
import {
  AppstoreOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  HistoryOutlined,
  LineOutlined,
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
  const [viewMode, setViewMode] = useState<"dashboard" | "storia">("dashboard");
  const [sortBy, setSortBy] = useState<"dataRicezione" | "dataEsa">("dataRicezione");
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);

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

    // Reset dello storico
    setSelectedHistoryIndex(null);
    setViewMode("dashboard");
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

  // Statistiche correnti o storiche
  const isHistoryActive = viewMode === "storia" && selectedHistoryIndex !== null;
  const currentStats = isHistoryActive && historyStats[selectedHistoryIndex ?? 0]
    ? {
        mediaPonderata: historyStats[selectedHistoryIndex ?? 0].mediaPonderata,
        votoPartenza: historyStats[selectedHistoryIndex ?? 0].votoPartenza,
        cfuFatti: historyStats[selectedHistoryIndex ?? 0].cfuAcquisiti,
        esamiSuperati: historyStats[selectedHistoryIndex ?? 0].esamiSuperati,
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
    const paddingY = 30;
    const chartHeight = 220;
    const chartWidth = 500;

    const maxVal = 30;
    const minVal = 18;

    const points = historyStats.map((item, idx) => {
      const x = paddingX + (idx / (historyStats.length - 1)) * (chartWidth - paddingX - 20);
      const y = chartHeight - paddingY - ((item.mediaPonderata - minVal) / (maxVal - minVal)) * (chartHeight - paddingY * 2);
      return { x, y, val: item.mediaPonderata, name: item.exam.adDes, idx };
    });

    let pathD = "";
    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y} `;
      for (let i = 1; i < points.length; i++) {
        pathD += `L ${points[i].x} ${points[i].y} `;
      }
    }

    const areaD = pathD 
      ? `${pathD} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`
      : "";

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
            const y = chartHeight - paddingY - ((val - minVal) / (maxVal - minVal)) * (chartHeight - paddingY * 2);
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

          {/* Area sfumata sotto la linea */}
          {areaD && <path d={areaD} fill="url(#chartGrad)" />}

          {/* Linea del grafico */}
          {pathD && (
            <path 
              d={pathD} 
              fill="none" 
              stroke="url(#lineGrad)" 
              strokeWidth="2.5" 
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Punti interattivi */}
          {points.map((pt) => {
            const isSelected = selectedHistoryIndex === pt.idx;
            return (
              <g key={pt.idx} style={{ cursor: "pointer" }} onClick={() => setSelectedHistoryIndex(pt.idx)}>
                <Tooltip title={`${pt.name}: ${pt.val.toFixed(2)}`}>
                  <circle 
                    cx={pt.x} 
                    cy={pt.y} 
                    r={isSelected ? 6 : 4} 
                    fill={isSelected ? "#fff" : "#1890ff"} 
                    stroke={isSelected ? "#1890ff" : "#fff"}
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
        <Space size={12} wrap>
          <Segmented
            options={[
              { label: "Dashboard", value: "dashboard", icon: <AppstoreOutlined /> },
              { label: "Storia", value: "storia", icon: <HistoryOutlined /> },
            ]}
            value={viewMode}
            onChange={(val) => {
              setViewMode(val as "dashboard" | "storia");
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
        />
      )}

      <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card 
            style={{ 
              height: "100%", 
              borderColor: isHistoryActive ? "#1890ff" : undefined, 
              boxShadow: isHistoryActive ? "0 0 8px rgba(24, 144, 255, 0.15)" : undefined,
              transition: "all 0.3s"
            }}
          >
            <Statistic
              title="Media ponderata"
              value={currentStats.mediaPonderata}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card 
            style={{ 
              height: "100%", 
              borderColor: isHistoryActive ? "#1890ff" : undefined,
              boxShadow: isHistoryActive ? "0 0 8px rgba(24, 144, 255, 0.15)" : undefined,
              transition: "all 0.3s"
            }}
          >
            <Statistic
              title="Voto di partenza"
              value={currentStats.mediaPonderata ? (currentStats.mediaPonderata / 30) * 110 : 0}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card 
            style={{ 
              height: "100%", 
              borderColor: isHistoryActive ? "#1890ff" : undefined,
              boxShadow: isHistoryActive ? "0 0 8px rgba(24, 144, 255, 0.15)" : undefined,
              transition: "all 0.3s"
            }}
          >
            <Statistic title="CFU acquisiti" value={currentStats.cfuFatti} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card 
            style={{ 
              height: "100%", 
              borderColor: isHistoryActive ? "#1890ff" : undefined,
              boxShadow: isHistoryActive ? "0 0 8px rgba(24, 144, 255, 0.15)" : undefined,
              transition: "all 0.3s"
            }}
          >
            <Statistic
              title="Esami superati"
              value={currentStats.esamiSuperati}
              suffix={`/ ${(s?.esamiSuperati ?? 0) + (s?.esamiDaFare ?? 0)}`}
            />
          </Card>
        </Col>
      </Row>

      {viewMode === "storia" ? (
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={10}>
            <Card 
              title="Linea Temporale Esami" 
              extra={
                <Radio.Group 
                  size="small" 
                  value={sortBy} 
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setSelectedHistoryIndex(null);
                  }}
                >
                  <Radio.Button value="dataRicezione">Reg/Verb</Radio.Button>
                  <Radio.Button value="dataEsa">Esame</Radio.Button>
                </Radio.Group>
              }
            >
              {historyStats.length === 0 ? (
                <div style={{ textAlign: "center", color: "rgba(0, 0, 0, 0.45)", padding: 24 }}>
                  Nessun esame superato registrato.
                </div>
              ) : (
                <div style={{ maxHeight: "65vh", overflowY: "auto", paddingRight: 8, paddingTop: 8 }}>
                  <Timeline
                    mode="left"
                    items={historyStats.map((item, idx) => {
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
                                  precision={4}
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
