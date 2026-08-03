import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function LanguagePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/settings?tab=language');
  }, []);

  return null;
}
