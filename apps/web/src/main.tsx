import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminPage from "./features/admin/AdminPage";
import EditorPage from "./features/editor/EditorPage";
import PreviewPage from "./features/preview/PreviewPage";
import "./globals.css";
function Invitation() {
  React.useEffect(() => {
    window.location.replace("/thiep-01/index.html" + window.location.search);
  }, []);
  return <p>Đang mở thiệp…</p>;
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/admin" element={<AdminPage />} />
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
