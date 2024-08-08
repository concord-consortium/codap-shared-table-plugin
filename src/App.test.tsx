import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

it("renders without crashing", () => {
  const div = document.createElement("div");
  const root = createRoot(div);
  expect(root).toBeDefined();
  root.render(<App />);
  root.unmount();
});
