"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { App, Button, Drawer, Grid, Layout, Menu, Spin, Typography } from "antd";
import {
  BookOutlined,
  CalendarOutlined,
  DashboardOutlined,
  LogoutOutlined,
  MenuOutlined,
  ReadOutlined,
} from "@ant-design/icons";
import LoginForm from "./LoginForm";

const { Header, Content, Sider } = Layout;

const ITEMS = [
  {
    key: "esse3",
    icon: <ReadOutlined />,
    label: "Esse3",
    children: [
      {
        key: "/",
        icon: <DashboardOutlined />,
        label: <Link href="/">Dashboard</Link>,
      },
      {
        key: "/esami",
        icon: <CalendarOutlined />,
        label: <Link href="/esami">Esami</Link>,
      },
    ],
  },
  {
    key: "/corsi",
    icon: <BookOutlined />,
    label: <Link href="/corsi">Elly</Link>,
  },
];

const SIDER_WIDTH = 200;

type Auth = "loading" | { user: string; matricola: string | null } | null;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [auth, setAuth] = useState<Auth>("loading");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) =>
        setAuth(
          d.authenticated
            ? { user: d.user, matricola: d.matricola ?? null }
            : null,
        ),
      )
      .catch(() => setAuth(null));
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuth(null);
  };

  const selected = useMemo(() => {
    if (pathname.startsWith("/esami")) return "/esami";
    if (pathname.startsWith("/corsi")) return "/corsi";
    return "/";
  }, [pathname]);

  // Chiudi il drawer a ogni cambio pagina.
  useEffect(() => setDrawerOpen(false), [pathname]);

  const brand = (
    <div style={{ padding: 16 }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Unidesk
      </Typography.Title>
    </div>
  );

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[selected]}
      defaultOpenKeys={["esse3"]}
      items={ITEMS}
    />
  );

  if (auth === "loading") {
    return (
      <Spin size="large" style={{ display: "block", marginTop: "20vh" }} />
    );
  }
  if (auth === null) {
    return <LoginForm onSuccess={(data) => setAuth(data)} />;
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {!isMobile && (
        <Sider
          theme="light"
          width={SIDER_WIDTH}
          style={{
            position: "fixed",
            insetBlock: 0,
            insetInlineStart: 0,
            height: "100vh",
            overflow: "auto",
          }}
        >
          {brand}
          {menu}
        </Sider>
      )}

      {isMobile && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={SIDER_WIDTH}
          styles={{ body: { padding: 0 } }}
          title="Unidesk"
        >
          {menu}
        </Drawer>
      )}

      <Layout
        style={{
          marginInlineStart: isMobile ? 0 : SIDER_WIDTH,
          transition: "margin-inline-start 0.2s",
        }}
      >
        <Header
          style={{
            background: "#fff",
            paddingInline: 24,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setDrawerOpen(true)}
              aria-label="Apri menu"
            />
          )}
          <div
            style={{
              marginInlineStart: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
            }}
          >
            <span
              style={{
                color: "rgba(0, 0, 0, 0.45)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "55vw",
              }}
            >
              {auth.user}
              {auth.matricola && ` · Matricola ${auth.matricola}`}
            </span>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={logout}
              aria-label="Esci"
            >
              {!isMobile && "Esci"}
            </Button>
          </div>
        </Header>
        <Content style={{ margin: 24 }}>
          <App>{children}</App>
        </Content>
      </Layout>
    </Layout>
  );
}
