export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="w-full max-w-md space-y-6 px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">LevyLite</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Strata management made simple
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
