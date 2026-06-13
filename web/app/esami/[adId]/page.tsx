"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  Alert,
  App,
  Button,
  Empty,
  Grid,
  List,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import type { AppelloConStato } from "@unidesk/core";
import { notifyUnauthorized } from "@/lib/api";

const fmt = (d: string | undefined) => (d ? d.slice(0, 10) : "-");

const { useBreakpoint } = Grid;

export default function EsameDettaglioPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { adId } = useParams<{ adId: string }>();
  const sp = useSearchParams();
  const matId = sp.get("matId");
  const cdsId = sp.get("cdsId");
  const adsceId = sp.get("adsceId");
  const stuId = sp.get("stuId");
  const nome = sp.get("n") ?? "Esame";

  const { message, modal } = App.useApp();
  const [appelli, setAppelli] = useState<AppelloConStato[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [esse3Url, setEsse3Url] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = () => {
    setError(null);
    setEsse3Url(null);
    fetch(`/api/esse3/appelli?matId=${matId}&cdsId=${cdsId}&adId=${adId}`)
      .then(async (res) => {
        if (res.status === 401) {
          notifyUnauthorized();
          throw new Error("Sessione scaduta");
        }
        const data = await res.json();
        if (!res.ok) {
          setEsse3Url(data.esse3Url ?? null);
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        return data as AppelloConStato[];
      })
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
          cdsId: Number(cdsId),
          adId: Number(adId),
          appId: a.appId,
          adsceId: Number(adsceId),
          stuId: Number(stuId),
        }),
      });
      if (res.status === 401) {
        notifyUnauthorized();
        return;
      }
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
      message.success(
        kind === "prenota" ? "Prenotazione effettuata" : "Disiscrizione effettuata",
      );
      load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const renderAzione = (a: AppelloConStato) => {
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
  };

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
      render: (_: unknown, a: AppelloConStato) => renderAzione(a),
    },
  ];

  return (
    <div>
      <Link href="/esami">
        <Button type="text" icon={<ArrowLeftOutlined />} style={{ marginBottom: 8 }}>
          Esami
        </Button>
      </Link>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        {nome}
      </Typography.Title>

      {error &&
        (esse3Url ? (
          <Alert
            type="warning"
            showIcon
            message="Appelli non disponibili via app per questo insegnamento"
            description="Esse3 limita l'accesso agli appelli di questo insegnamento (es. esame mutuato). Gestisci la prenotazione direttamente su Esse3."
            action={
              <Button
                size="small"
                onClick={() => window.open(esse3Url, "_blank", "noopener")}
              >
                Apri su Esse3
              </Button>
            }
          />
        ) : (
          <Alert type="error" showIcon message={error} />
        ))}
      {!error && !appelli && <Spin />}
      {!error && appelli && appelli.length === 0 && (
        <Empty description="Nessun appello disponibile" />
      )}
      {!error &&
        appelli &&
        appelli.length > 0 &&
        (isMobile ? (
          <List
            dataSource={appelli}
            rowKey="appId"
            renderItem={(a) => (
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
                    <Typography.Text strong>
                      {fmt(a.dataInizioApp)}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ flexShrink: 0 }}>
                      {a.numIscritti} iscritti
                    </Typography.Text>
                  </div>
                  <Typography.Text type="secondary">{a.desApp}</Typography.Text>
                  <div style={{ marginTop: 4 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Iscrizioni: {fmt(a.dataInizioIscr)} - {fmt(a.dataFineIscr)}
                    </Typography.Text>
                  </div>
                  <div style={{ marginTop: 8 }}>{renderAzione(a)}</div>
                </div>
              </List.Item>
            )}
          />
        ) : (
          <Table
            rowKey="appId"
            dataSource={appelli}
            columns={columns}
            pagination={false}
            size="small"
            scroll={{ x: "max-content" }}
          />
        ))}
    </div>
  );
}
