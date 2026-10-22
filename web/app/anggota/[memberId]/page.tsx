import { PinjamanAnggotaPage } from "./view";

export default async function Page({ params }: PageProps<"/anggota/[memberId]">) {
  const { memberId } = await params;
  return <PinjamanAnggotaPage memberId={memberId} />;
}
