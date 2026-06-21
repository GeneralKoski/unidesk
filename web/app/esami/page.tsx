"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Card, Empty, Space, Spin, Tag, Typography } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import type { RigaDaSostenere, TrattoCarriera } from "@unidesk/core";
import { getJSON } from "@/lib/api";
import SortableGrid from "@/lib/SortableGrid";

export default function EsamiPage() {
  const router = useRouter();
  const [matId, setMatId] = useState<number | null>(null);
  const [righe, setRighe] = useState<RigaDaSostenere[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const carriere = await getJSON<TrattoCarriera[]>("/api/esse3/carriere");
        const attiva = carriere.find((t) => t.staStuCod === "A") ?? carriere[0];
        if (!attiva) throw new Error("Nessuna carriera trovata");
        setMatId(attiva.matId);
        setRighe(
          await getJSON<RigaDaSostenere[]>(`/api/esse3/da-sostenere?matId=${attiva.matId}`),
        );
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

  if (righe.length === 0)
    return <Empty description="Nessun esame da sostenere" />;

  const statoTag = (r: RigaDaSostenere) =>
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

  return (
    <div>
      <Typography.Title level={3}>Esami da sostenere</Typography.Title>
      <SortableGrid
        items={righe}
        getId={(r) => String(r.chiaveADContestualizzata.adId)}
        storageKey="unidesk:order:esami"
        renderItem={(r) => {
          const k = r.chiaveADContestualizzata;
          const q = new URLSearchParams({
            matId: String(matId),
            cdsId: String(k.cdsId),
            adsceId: String(r.adsceId),
            stuId: String(r.stuId),
            n: r.adDes,
          });
          return (
            <Card
              hoverable
              onClick={() => router.push(`/esami/${k.adId}?${q.toString()}`)}
              style={{ height: "100%" }}
              title={
                <Space>
                  <CalendarOutlined style={{ color: "#1677ff" }} />
                  <span style={{ whiteSpace: "normal" }}>{r.adDes}</span>
                </Space>
              }
            >
              <Space direction="vertical" size={4}>
                <Space size={8}>
                  <Tag>{r.peso} CFU</Tag>
                  {statoTag(r)}
                </Space>
                {r.prenotazione?.dataAppello && (
                  <Typography.Text type="secondary">
                    Appello {r.prenotazione.dataAppello.slice(0, 10)}
                  </Typography.Text>
                )}
              </Space>
            </Card>
          );
        }}
      />
    </div>
  );
}
