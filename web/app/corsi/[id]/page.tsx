"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Alert, Button, Card, Empty, List, Spin, Tag, Typography } from "antd";
import { ArrowLeftOutlined, FileOutlined, LinkOutlined } from "@ant-design/icons";
import type { Module, Section } from "@unidesk/core";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

function ModuleItem({ m }: { m: Module }) {
  const isFile = m.modname === "resource" || m.modname === "folder";
  const icon = isFile ? <FileOutlined /> : <LinkOutlined />;
  if (m.url) {
    const href = `/api/elly/file?url=${encodeURIComponent(m.url)}`;
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {icon} {m.name}
      </a>
    );
  }
  return <span>{m.name}</span>;
}

export default function CorsoDettaglioPage() {
  const { id } = useParams<{ id: string }>();
  const nome = useSearchParams().get("n") ?? "Corso";
  const [sections, setSections] = useState<Section[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJSON<Section[]>(`/api/elly/contents?courseid=${id}`)
      .then(setSections)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [id]);

  return (
    <div>
      <Link href="/corsi">
        <Button type="text" icon={<ArrowLeftOutlined />} style={{ marginBottom: 8 }}>
          Corsi
        </Button>
      </Link>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        {nome}
      </Typography.Title>

      {error && <Alert type="error" showIcon message={error} />}
      {!error && !sections && <Spin />}
      {!error && sections && sections.length === 0 && (
        <Empty description="Nessun contenuto" />
      )}
      {!error &&
        sections?.map((s) => (
          <Card
            key={s.id}
            type="inner"
            size="small"
            title={s.name || `Sezione ${s.section}`}
            style={{ marginBottom: 12 }}
          >
            <List
              size="small"
              dataSource={s.modules}
              renderItem={(m) => (
                <List.Item>
                  <ModuleItem m={m} />
                  <Tag style={{ marginLeft: "auto" }}>{m.modname}</Tag>
                </List.Item>
              )}
            />
          </Card>
        ))}
    </div>
  );
}
