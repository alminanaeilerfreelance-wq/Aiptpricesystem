import ResetPasswordForm from './ResetPasswordForm';

interface ResetPasswordPageProps {
  searchParams: {
    token?: string;
  };
}

export default function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const token = searchParams.token ?? '';

  return <ResetPasswordForm token={token} />;
}
