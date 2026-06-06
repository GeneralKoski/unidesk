"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Card,
  Collapse,
  Empty,
  List,
  Spin,
  Tag,
  Typography,
} from "antd";
import { FileOutlined, LinkOutlined } from "@ant-design/icons";
import type { Course, Module, Section } from "@unidesk/core";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

function ModuleItem({ m }: { m: Module }) {
  const file = m.contents?.find((c) => c.fileurl);
  if (file) {
    return (
      <a href={file.fileurl} target="_blank" rel="noreferrer">
        <FileOutlined /> {m.name}
      </a>
    );
  }
  if (m.url) {
    return (
      <a href={m.url} target="_blank" rel="noreferrer">
        <LinkOutlined /> {m.name}
      </a>
    );
  }
  return <span>{m.name}</span>;
}

function CourseContents({ courseid }: { courseid: number }) {
  const [sections, setSections] = useState<Section[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJSON<Section[]>(`/api/elly/contents?courseid=${courseid}`)
      .then(setSections)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [courseid]);

  if (error) return <Alert type="error" showIcon message={error} />;
  if (!sections) return <Spin />;

  const visible = sections.filter((s) => s.modules.length > 0);
  if (visible.length === 0) return <Empty description="Nessun contenuto" />;

  return (
    <>
      {visible.map((s) => (
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
    </>
  );
}

export default function CorsiPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getJSON<Course[]>("/api/elly/courses")
      .then(setCourses)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: "block", marginTop: 80 }} />;

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="Impossibile leggere Elly"
        description={`${error}. Verifica ELLY_BASE e le credenziali ELLY_* nel file .env.`}
      />
    );
  }

  if (courses.length === 0) return <Empty description="Nessun corso" />;

  return (
    <div>
      <Typography.Title level={3}>Corsi su Elly</Typography.Title>
      <Collapse
        accordion
        items={courses.map((c) => ({
          key: String(c.id),
          label: c.fullname ?? c.displayname ?? c.shortname,
          children: <CourseContents courseid={c.id} />,
        }))}
      />
    </div>
  );
}
