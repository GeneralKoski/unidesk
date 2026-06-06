"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Card,
  Col,
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

export default function CarrieraPage() {
  const router = useRouter();
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
        description={`${error}. Controlla le credenziali ESSE3_* nel file .env.`}
      />
    );
  }

  const sel = carriere.find((t) => t.matId === matId);
  const s = libretto?.stats;

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
          <Tag color="green">{r.esito.voto}</Tag>
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
          <Tag color="gold">{r.prenotazione.prenotabili} prenotabile/i</Tag>
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
      <Space
        align="center"
        style={{
          marginBottom: 24,
          justifyContent: "space-between",
          width: "100%",
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
            style={{ minWidth: 320 }}
            options={carriere.map((t) => ({
              value: t.matId,
              label: carrieraLabel(t),
            }))}
          />
        )}
      </Space>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Media ponderata"
              value={s?.mediaPonderata ?? 0}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="CFU acquisiti" value={s?.cfuFatti ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Esami superati" value={s?.esamiSuperati ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Esami da fare" value={s?.esamiDaFare ?? 0} />
          </Card>
        </Col>
      </Row>

      <Card title="Esami superati" style={{ marginBottom: 24 }}>
        <Table
          rowKey={(r) => r.chiaveADContestualizzata.adId}
          dataSource={libretto?.superate ?? []}
          columns={colSuperate}
          pagination={false}
          size="small"
          loading={librettoLoading}
        />
      </Card>

      <Card title="Da sostenere">
        <Table
          rowKey={(r) => r.chiaveADContestualizzata.adId}
          dataSource={
            daSostenere ??
            ((libretto?.daFare ?? []).map((r) => ({
              ...r,
              prenotazione: {
                stato: "nessuno",
                prenotabili: 0,
                dataPrenotazione: null,
                dataAppello: null,
              },
            })) as RigaDaSostenere[])
          }
          columns={colDaFare}
          pagination={false}
          size="small"
          loading={librettoLoading || dsLoading}
          onRow={(r) => ({
            style: { cursor: "pointer" },
            onClick: () => {
              const k = r.chiaveADContestualizzata;
              const q = new URLSearchParams({
                matId: String(matId),
                cdsId: String(k.cdsId),
                adsceId: String(r.adsceId),
                stuId: String(r.stuId),
                n: r.adDes,
              });
              router.push(`/esami/${k.adId}?${q.toString()}`);
            },
          })}
        />
      </Card>
    </div>
  );
}
