import { PinjamPage } from "./view";

export default async function Page({ params }: PageProps<"/pinjam/[id]">) {
  const { id } = await params;
  return <PinjamPage id={id} />;
}
