import { PublicQuizRunner } from "@/components/public/public-quiz-runner";

export const metadata = {
  title: "Kuis",
  robots: { index: false },
};

export default async function PublicQuizPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="min-h-screen bg-gray-25">
      <PublicQuizRunner token={token} />
    </main>
  );
}
