"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { SocketProvider } from "@/contexts/SocketContext";
import { useLocation } from "@/lib/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import PublicRoute from "@/components/PublicRoute";
import AppLayout from "@/components/layout/AppLayout";
import Splash from "@/screens/Splash";
import Login from "@/screens/Login";
import Feed from "@/screens/Feed";
import Trending from "@/screens/Trending";
import Create from "@/screens/Create";
import Promote from "@/screens/Promote";
import Profile from "@/screens/Profile";
import Wallet from "@/screens/Wallet";
import Settings from "@/screens/Settings";
import EditProfile from "@/screens/EditProfile";
import PrivacySettings from "@/screens/PrivacySettings";
import VerifiedBadge from "@/screens/VerifiedBadge";
import PaymentSettings from "@/screens/PaymentSettings";
import CreatorDashboard from "@/screens/CreatorDashboard";
import Messages from "@/screens/Messages";
import Notifications from "@/screens/Notifications";
import PostDetail from "@/screens/PostDetail";
import Onboarding from "@/screens/Onboarding";
import VideoReels from "@/screens/VideoReels";
import NotFound from "@/screens/NotFound";

const appRoutes: Record<string, React.ComponentType> = {
  "/feed": Feed,
  "/trending": Trending,
  "/create": Create,
  "/promote": Promote,
  "/profile": Profile,
  "/wallet": Wallet,
  "/settings": Settings,
  "/settings/edit-profile": EditProfile,
  "/settings/privacy": PrivacySettings,
  "/settings/verified": VerifiedBadge,
  "/settings/payment": PaymentSettings,
  "/dashboard": CreatorDashboard,
  "/messages": Messages,
  "/notifications": Notifications,
};

function RouteCanvas() {
  const { pathname } = useLocation();

  if (pathname === "/") return <Splash />;
  if (pathname === "/login") {
    return (
      <PublicRoute>
        <Login />
      </PublicRoute>
    );
  }

  if (pathname === "/onboarding") {
    return (
      <ProtectedRoute>
        <Onboarding />
      </ProtectedRoute>
    );
  }

  if (pathname === "/reels") {
    return (
      <ProtectedRoute>
        <VideoReels />
      </ProtectedRoute>
    );
  }

  let Screen = appRoutes[pathname];
  if (pathname === "/profile/edit") Screen = EditProfile;
  if (pathname.startsWith("/profile/")) Screen = Profile;
  if (pathname.startsWith("/post/")) Screen = PostDetail;
  if (!Screen) Screen = NotFound;

  return (
    <ProtectedRoute>
      <AppLayout>
        <Screen />
      </AppLayout>
    </ProtectedRoute>
  );
}

export default function ClientApp() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 5 * 60 * 1000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SocketProvider>
            <Toaster />
            <Sonner position="top-center" richColors closeButton />
            <RouteCanvas />
          </SocketProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
