"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Collapse,
  Empty,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import type {
  AppelloConStato,
  Libretto,
  RigaLibretto,
  TrattoCarriera,
} from "@unidesk/core";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

const fmt = (d: string | undefined) => (d ? d.slice(0, 10) : "-");

function Appelli({ matId, riga }: { matId: number; riga: RigaLibretto }) {
  const { message, modal } = App.useApp();
  const { cdsId, adId } = riga.chiaveADContestualizzata;
  const [appelli, setAppelli] = useState<AppelloConStato[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = () => {
    setError(null);
    getJSON<AppelloConStato[]>(
      `/api/esse3/appelli?matId=${matId}&cdsId=${cdsId}&adId=${adId}`,
    )
      .then(setAppelli)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  };

  useEffect(load, [matId, cdsId, adId]);

  const act = async (a: AppelloConStato, kind: "prenota" | "disiscrivi") => {
    setBusy(a.appId);
    try {
      const res = await fetch(`/api/esse3/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cdsId,
          adId,
          appId: a.appId,
          adsceId: riga.adsceId,
          stuId: riga.stuId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.questionarioUrl) {
          modal.confirm({
            title: "Questionario da compilare",
            content: `${data.error}. Compilalo su Esse3, poi torna qui e riprova la prenotazione.`,
            okText: "Vai al questionario",
            cancelText: "Chiudi",
            onOk: () => window.open(data.questionarioUrl, "_blank", "noopener"),
          });
        } else {
          message.error(data.error ?? `HTTP ${res.status}`);
        }
        return;
      }
      message.success(kind === "prenota" ? "Prenotazione effettuata" : "Disiscrizione effettuata");
      load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  if (error) return <Alert type="error" showIcon message={error} />;
  if (!appelli) return <Spin />;
  if (appelli.length === 0)
    return <Empty description="Nessun appello disponibile" />;

  const columns = [
    {
      title: "Data esame",
      key: "data",
      render: (_: unknown, a: AppelloConStato) => fmt(a.dataInizioApp),
    },
    { title: "Appello", dataIndex: "desApp", key: "desApp" },
    {
      title: "Iscrizioni",
      key: "iscr",
      render: (_: unknown, a: AppelloConStato) =>
        `${fmt(a.dataInizioIscr)} - ${fmt(a.dataFineIscr)}`,
    },
    { title: "Iscritti", dataIndex: "numIscritti", key: "numIscritti", width: 90 },
    {
      title: "Azione",
      key: "azione",
      width: 220,
      render: (_: unknown, a: AppelloConStato) => {
        if (a.prenotato) {
          return (
            <Space>
              <Tag color="green">Prenotato</Tag>
              <Popconfirm
                title="Disiscriverti da questo appello?"
                okText="Disiscriviti"
                okButtonProps={{ danger: true }}
                cancelText="Annulla"
                onConfirm={() => act(a, "disiscrivi")}
              >
                <Button size="small" danger loading={busy === a.appId}>
                  Disiscriviti
                </Button>
              </Popconfirm>
            </Space>
          );
        }
        if (a.prenotabile) {
          return (
            <Popconfirm
              title="Confermi la prenotazione a questo appello?"
              okText="Prenota"
              cancelText="Annulla"
              onConfirm={() => act(a, "prenota")}
            >
              <Button size="small" type="primary" loading={busy === a.appId}>
                Prenota
              </Button>
            </Popconfirm>
          );
        }
        if (a.iscrizioni === "futura") {
          return <Tag color="default">Apre il {fmt(a.dataInizioIscr)}</Tag>;
        }
        return <Tag>Prenotazioni chiuse</Tag>;
      },
    },
  ];

  return (
    <Table
      rowKey="appId"
      dataSource={appelli}
      columns={columns}
      pagination={false}
      size="small"
    />
  );
}

export default function EsamiPage() {
  const [matId, setMatId] = useState<number | null>(null);
  const [daFare, setDaFare] = useState<RigaLibretto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const carriere = await getJSON<TrattoCarriera[]>("/api/esse3/carriere");
        const attiva = carriere.find((t) => t.staStuCod === "A") ?? carriere[0];
        if (!attiva) throw new Error("Nessuna carriera trovata");
        setMatId(attiva.matId);
        const libretto = await getJSON<Libretto>(
          `/api/esse3/libretto?matId=${attiva.matId}`,
        );
        setDaFare(libretto.daFare);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  if (daFare.length === 0)
    return <Empty description="Nessun esame da sostenere" />;

  return (
    <div>
      <Typography.Title level={3}>Esami da sostenere</Typography.Title>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="Prenota e disiscriviti agiscono su Esse3 reale. Gli endpoint calesa non sono ancora verificati: conferma sempre prima di agire."
      />
      <Collapse
        accordion
        items={daFare.map((r) => ({
          key: String(r.chiaveADContestualizzata.adId),
          label: (
            <Space>
              {r.adDes}
              {r.numPrenotazioni > 0 ? (
                <Tag color="blue">Già prenotato</Tag>
              ) : r.numAppelliPrenotabili > 0 ? (
                <Tag color="gold">{r.numAppelliPrenotabili} prenotabile/i</Tag>
              ) : (
                <Tag>Nessun appello</Tag>
              )}
            </Space>
          ),
          children: matId ? <Appelli matId={matId} riga={r} /> : null,
        }))}
      />
    </div>
  );
}
