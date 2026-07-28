import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["100.107.250.78", "100.124.185.116"],
  turbopack: {
    root: process.cwd(),
  },
  redirects: async () => [
    { source: "/finanzas", destination: "/app/finanzas", permanent: false },
    { source: "/finanzas/:path*", destination: "/app/finanzas/:path*", permanent: false },
    {
      source: "/administrador/finanzas",
      destination: "/app/finanzas",
      permanent: false,
    },
    {
      source: "/administrador/finanzas/cuentas",
      destination: "/app/finanzas/cuentas",
      permanent: false,
    },
    {
      source: "/administrador/finanzas/movimientos",
      destination: "/app/finanzas/movimientos",
      permanent: false,
    },
    {
      source: "/administrador/finanzas/historico",
      destination: "/app/finanzas/historico",
      permanent: false,
    },
    {
      source: "/administrador/finanzas/registrar-cuenta",
      destination: "/app/finanzas/registrar-cuenta",
      permanent: false,
    },
    {
      source: "/administrador/finanzas/registrar-movimiento",
      destination: "/app/finanzas/registrar-movimiento",
      permanent: false,
    },
    {
      source: "/administrador/entrenamientos",
      destination: "/app/entrenamientos",
      permanent: false,
    },
    {
      source: "/administrador/entrenamientos/iniciar-fuerza",
      destination: "/app/entrenamientos/iniciar-fuerza",
      permanent: false,
    },
    {
      source: "/administrador/entrenamientos/activo",
      destination: "/app/entrenamientos/activo",
      permanent: false,
    },
    {
      source: "/administrador/entrenamientos/historico",
      destination: "/app/entrenamientos/historico",
      permanent: false,
    },
  ],
};

export default nextConfig;
