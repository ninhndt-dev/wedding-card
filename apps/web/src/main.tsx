import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminPage from "./features/admin/AdminPage";
import InvitationsPage from "./features/admin/InvitationsPage";
import EditorPage from "./features/editor/EditorPage";
import PreviewPage from "./features/preview/PreviewPage";
import "./globals.css";
function Invitation() {
  React.useEffect(() => {
    window.location.replace("/thiep-01/index.html" + window.location.search);
  }, []);
  return <p>Đang mở thiệp…</p>;
}
async function start() {
  if (location.pathname.startsWith("/admin")) {
    try {
      const response = await fetch("/api/health", {
        signal: AbortSignal.timeout(8000),
      });
      const configured = response.headers.get("X-Wedding-Origin");
      if (configured) {
        const canonical = new URL(configured);
        if (
          canonical.protocol === "https:" &&
          canonical.origin !== location.origin
        ) {
          location.replace(
            canonical.origin +
              location.pathname +
              location.search +
              location.hash,
          );
          return;
        }
      }
    } catch {
      /* Keep the login page available when the health request fails. */
    }
  }
  createRoot(document.getElementById("root")!).render(
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/invitations" element={<InvitationsPage />} />
        <Route path="/admin/editor" element={<EditorPage />} />
        <Route path="/admin/preview" element={<PreviewPage />} />
        <Route path="/" element={<Invitation />} />
        <Route
          path="*"
          element={
            <p>
              Không tìm thấy trang. <a href="/">Mở thiệp</a>
            </p>
          }
        />
      </Routes>
    </BrowserRouter>,
  );
}
start();
