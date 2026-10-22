import { DetailBukuPage } from "./view";

export default async function Page({ params }: PageProps<"/buku/[id]">) {
  const { id } = await params;
  return <DetailBukuPage id={id} />;
}
