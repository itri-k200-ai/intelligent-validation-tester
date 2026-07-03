"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LOGIN_ENABLED } from "@/config/auth";
import { useLogin } from "@/hooks/Auth/useLogin";
import { loginSchema, type LoginInput } from "@/lib/validators";

export default function LoginPage() {
  const router = useRouter();
  // 登入關閉時不顯示登入頁,直接導回主頁(交給自動登入)。
  useEffect(() => {
    if (!LOGIN_ENABLED) router.replace("/overview");
  }, [router]);

  const { login, isLoading, error } = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "admin", password: "admin" },
  });

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>登入 智慧驗證 tester</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((v) => login(v))} className="space-y-4">
            <div>
              <label className="text-sm text-white/70">帳號 / Email</label>
              <Input type="text" autoComplete="username" {...register("identifier")} />
              {errors.identifier && (
                <p className="text-xs text-danger mt-1">{errors.identifier.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm text-white/70">密碼</label>
              <Input type="password" autoComplete="current-password" {...register("password")} />
              {errors.password && <p className="text-xs text-danger mt-1">{errors.password.message}</p>}
            </div>
            {error && <p className="text-xs text-danger">登入失敗:帳號或密碼錯誤</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "登入中…" : "登入"}
            </Button>
            <p className="text-xs text-white/40 text-center">
              預設: admin(或 admin@ivt.local) / admin
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
