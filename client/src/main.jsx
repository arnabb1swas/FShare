import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import Upload from "./pages/Upload.jsx";
import Download from "./pages/Download.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Upload />} />
        <Route path="/files/:slug" element={<Download />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
