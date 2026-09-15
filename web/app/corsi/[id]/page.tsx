"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Alert, Button, Card, Empty, List, Spin, Tag, Typography } from "antd";
import {
  ArrowLeftOutlined,
  DownOutlined,
  FileOutlined,
  FolderOutlined,
  LinkOutlined,
  RightOutlined,
} from "@ant-design/icons";
import type { Module, Section } from "@unidesk/core";
import { getJSON } from "@/lib/api";

// Ogni chiamata porta con se' l'istanza Elly del corso: gli id e gli URL dei
// moduli sono per-istanza, e senza "base" si finirebbe a chiedere all'anno
// corrente contenuti che stanno su quello precedente.
const fileHref = (url: string, base: string, modname?: string) =>
  `/api/elly/file?url=${encodeURIComponent(url)}&base=${encodeURIComponent(base)}` +
  (modname ? `&modname=${encodeURIComponent(modname)}` : "");

function FolderItem({ m, base }: { m: Module; base: string }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<{ name: string; url: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setOpen((o) => !o);
    if (files || !m.url) return;
    setLoading(true);
    try {
      setFiles(
        await getJSON(
          `/api/elly/folder?url=${encodeURIComponent(m.url)}&base=${encodeURIComponent(base)}`,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: "100%" }}>
      <a onClick={toggle} style={{ cursor: "pointer" }}>
        <FolderOutlined /> {m.name} {open ? <DownOutlined /> : <RightOutlined />}
      </a>
      {open &&
        (loading ? (
          <Spin size="small" style={{ marginInlineStart: 24 }} />
        ) : error ? (
          <Alert type="error" showIcon message={error} style={{ marginTop: 8 }} />
        ) : (
          <List
            size="small"
            dataSource={files ?? []}
            locale={{ emptyText: "Cartella vuota" }}
            style={{ marginInlineStart: 24 }}
            renderItem={(f) => (
              <List.Item>
                <a href={fileHref(f.url, base)} target="_blank" rel="noreferrer">
                  <FileOutlined /> {f.name}
                </a>
              </List.Item>
            )}
          />
        ))}
    </div>
  );
}

function ModuleItem({ m, base }: { m: Module; base: string }) {
  if (m.modname === "folder") return <FolderItem m={m} base={base} />;
  const icon = m.modname === "resource" ? <FileOutlined /> : <LinkOutlined />;
  if (m.url) {
    return (
      <a href={fileHref(m.url, base, m.modname)} target="_blank" rel="noreferrer">
        {icon} {m.name}
      </a>
    );
  }
  return <span>{m.name}</span>;
}

export default function CorsoDettaglioPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const nome = params.get("n") ?? "Corso";
  const base = params.get("base") ?? "";
  const [sections, setSections] = useState<Section[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = base ? `&base=${encodeURIComponent(base)}` : "";
    getJSON<Section[]>(`/api/elly/contents?courseid=${id}${q}`)
      .then(setSections)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [id, base]);

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
                  <ModuleItem m={m} base={base} />
                  <Tag style={{ marginLeft: "auto" }}>{m.modname}</Tag>
                </List.Item>
              )}
            />
          </Card>
        ))}
    </div>
  );
}
