"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { App, Button, Drawer, Grid, Layout, Menu, Typography } from "antd";
import {
  BookOutlined,
  CalendarOutlined,
  DashboardOutlined,
  MenuOutlined,
  ReadOutlined,
} from "@ant-design/icons";

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
  { key: "/corsi", icon: <BookOutlined />, label: <Link href="/corsi">Elly</Link> },
];

const SIDER_WIDTH = 200;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const [drawerOpen, setDrawerOpen] = useState(false);

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
          <Typography.Text type="secondary">
            Università di Parma · Scienze Informatiche
          </Typography.Text>
        </Header>
        <Content style={{ margin: 24 }}>
          <App>{children}</App>
        </Content>
      </Layout>
    </Layout>
  );
}
