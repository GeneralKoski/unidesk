"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Card, Col, Empty, Row, Spin, Typography } from "antd";
import { BookOutlined } from "@ant-design/icons";
import type { Course } from "@unidesk/core";
import { getJSON } from "@/lib/api";

export default function CorsiPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getJSON<Course[]>("/api/elly/courses")
      .then(setCourses)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <Spin size="large" style={{ display: "block", marginTop: 80 }} />;

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="Impossibile leggere Elly"
        description={`${error} Elly a volte è instabile: prova a ricaricare la pagina.`}
      />
    );
  }

  if (courses.length === 0) return <Empty description="Nessun corso" />;

  return (
    <div>
      <Typography.Title level={3}>Corsi su Elly</Typography.Title>
      <Row gutter={[16, 16]}>
        {courses.map((c) => (
          <Col xs={24} sm={12} lg={8} key={c.id}>
            <Card
              hoverable
              onClick={() =>
                router.push(
                  `/corsi/${c.id}?n=${encodeURIComponent(c.fullname ?? c.shortname)}`,
                )
              }
              style={{ height: "100%" }}
            >
              <Card.Meta
                avatar={<BookOutlined style={{ fontSize: 22, color: "#1677ff" }} />}
                title={c.fullname ?? c.shortname}
                description={c.shortname}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
