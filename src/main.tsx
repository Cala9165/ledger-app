import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Navigate, RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { AppErrorComponent } from "@/lib/error-component";
import "./styles.css";

/** Unknown paths land on Home (replace) — no sticky 404 URL. */
function NotFoundRedirect() {
  return <Navigate to="/" replace />;
}

const router = createRouter({
  routeTree,
  defaultErrorComponent: AppErrorComponent,
  defaultNotFoundComponent: NotFoundRedirect,
  trailingSlash: "never",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
