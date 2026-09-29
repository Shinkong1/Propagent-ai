'use client';
import { useState } from 'react';
import styles from '../../styles/Landing.module.css';
import { useReveal } from './useReveal';
import { contact } from '../../lib/api';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function DemoForm() {
  const { ref, inView } = useReveal<HTMLDivElement>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [units, setUnits] = useState('11-50');
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState<{ text: string; kind: 'ok' | 'warn' } | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || !EMAIL_RE.test(email.trim())) {
      setNote({ text: 'Add your name and a valid work email to continue.', kind: 'warn' });
      return;
    }
    setSubmitting(true);
    try {
      await contact.demoRequest(trimmedName, email.trim(), units);
      setNote({ text: `Thanks, ${trimmedName.split(' ')[0]}. We'll be in touch shortly to set up your demo.`, kind: 'ok' });
      setName(''); setEmail('');
    } catch {
      setNote({ text: "Something went wrong on our end -- please try again, or email propagentapp@gmail.com directly.", kind: 'warn' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="demo" className={styles.section}>
      <div ref={ref} className={`${styles.demo} ${styles.rv} ${inView ? styles.rvIn : ''}`}>
        <div>
          <span className={styles.eyebrow}>Get started</span>
          <h2 style={{ marginTop: 14 }}>See PropAgent run your portfolio.</h2>
          <p className={styles.demoLede}>We&apos;ll set up a live demo with your own units, vendors and rules, so you can hear it answer a tenant call before you commit.</p>
        </div>
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <label className={styles.label} htmlFor="f-name">Your name
            <input className={styles.input} id="f-name" name="name" autoComplete="name" required placeholder="Jordan Lee" value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label className={styles.label} htmlFor="f-email">Work email
            <input className={styles.input} id="f-email" name="email" type="email" autoComplete="email" required placeholder="jordan@company.com" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label className={styles.label} htmlFor="f-units">Units you manage
            <select className={styles.input} id="f-units" name="units" value={units} onChange={e => setUnits(e.target.value)}>
              <option value="1-10">1-10</option>
              <option value="11-50">11-50</option>
              <option value="51-200">51-200</option>
              <option value="200+">200+</option>
            </select>
          </label>
          <button className={`${styles.btn} ${styles.btnAmber}`} type="submit" disabled={submitting} style={{ justifyContent: 'center', marginTop: 4 }}>
            {submitting ? 'Sending...' : 'Request a demo'}
          </button>
          <p className={`${styles.formNote} ${note?.kind === 'ok' ? styles.formNoteOk : note?.kind === 'warn' ? styles.formNoteWarn : ''}`} role="status">
            {note?.text}
          </p>
        </form>
      </div>
    </section>
  );
}
