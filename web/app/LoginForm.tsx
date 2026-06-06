"use client";

import { useState } from "react";
import { Alert, Button, Card, Form, Input, Typography } from "antd";

export default function LoginForm({
  onSuccess,
}: {
  onSuccess: (user: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (v: { user: string; pass: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login fallito");
        return;
      }
      onSuccess(data.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Card style={{ width: 400, maxWidth: "100%" }}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          Unidesk
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Accedi con le credenziali Unipr (le stesse di Esse3 ed Elly).
        </Typography.Paragraph>
        {error && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message={error}
          />
        )}
        <Form layout="vertical" onFinish={submit} disabled={loading}>
          <Form.Item
            name="user"
            label="Email Unipr"
            rules={[{ required: true, message: "Inserisci l'email" }]}
          >
            <Input
              autoComplete="username"
              placeholder="nome.cognome@studenti.unipr.it"
            />
          </Form.Item>
          <Form.Item
            name="pass"
            label="Password"
            rules={[{ required: true, message: "Inserisci la password" }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Accedi
          </Button>
        </Form>
        <Typography.Paragraph
          type="secondary"
          style={{ fontSize: 12, marginTop: 16, marginBottom: 0 }}
        >
          Le credenziali restano cifrate in un cookie di sessione e servono solo
          ad accedere a Esse3 ed Elly per tuo conto.
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
