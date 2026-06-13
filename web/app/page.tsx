"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Card,
  Col,
  Grid,
  List,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
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
  }, [matId]);

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
          <Tag>idoneo</Tag>
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
        {carriere.length > 1 && (
          <Select
            value={matId ?? undefined}
            onChange={setMatId}
            style={{ width: "100%", maxWidth: 320 }}
            options={carriere.map((t) => ({
              value: t.matId,
              label: carrieraLabel(t),
            }))}
          />
        )}
      </div>

      <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card style={{ height: "100%" }}>
            <Statistic
              title="Media ponderata"
              value={s?.mediaPonderata ?? 0}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card style={{ height: "100%" }}>
            <Statistic title="CFU acquisiti" value={s?.cfuFatti ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card style={{ height: "100%" }}>
            <Statistic title="Esami superati" value={s?.esamiSuperati ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card style={{ height: "100%" }}>
            <Statistic title="Esami da fare" value={s?.esamiDaFare ?? 0} />
          </Card>
        </Col>
      </Row>

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
                        : "idoneo"}
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
    </div>
  );
}
