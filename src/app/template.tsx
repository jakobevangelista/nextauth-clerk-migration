import MigrationLayout from "./_wrappers/serverWrapper";

export default function Tempalate({ children }: { children: React.ReactNode }) {
  return <MigrationLayout>{children}</MigrationLayout>;
}
