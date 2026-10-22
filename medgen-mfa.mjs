/**
 * MedGen AI — Supabase Auth TOTP MFA controller (ES module).
 * This controller is for Supabase-authenticated users ONLY. It deliberately
 * does not accept/upgrade legacy MedGen backend session tokens.
 * Dependency injected: pass an existing @supabase/supabase-js v2 client.
 * Never store or log a TOTP secret, enrollment URI, or access token.
 */

const MFA_REQUIRED_ROLES = new Set(['doctor', 'researcher', 'pharma', 'super_admin']);

function unwrap(result, action) {
  if (result?.error) {
    // Never include a returned factor secret or token in the thrown error.
    throw new Error(`${action}: ${result.error.message || 'xatolik'}`);
  }
  return result?.data;
}
function validCode(code) {
  const normalized = String(code ?? '').trim();
  if (!/^\d{6}$/.test(normalized)) throw new Error('Authenticator kodini 6 ta raqamda kiriting.');
  return normalized;
}

export function createMedgenMfa(supabase) {
  if (!supabase?.auth?.mfa || !supabase?.from) throw new Error('Supabase client talab qilinadi.');

  async function currentUser() {
    const { user } = unwrap(await supabase.auth.getUser(), 'Foydalanuvchini tekshirish') || {};
    return user || null;
  }

  async function getMfaState() {
    const user = await currentUser();
    if (!user) return { status: 'signed_out' };

    // Authoritative database role, not app.user_metadata or localStorage.
    const profile = unwrap(
      await supabase.from('profiles').select('role,verification').eq('id', user.id).single(),
      'RBAC profilini olish'
    );
    if (!profile) throw new Error('RBAC profili topilmadi.');
    const role = profile.role;
    const aal = unwrap(await supabase.auth.mfa.getAuthenticatorAssuranceLevel(), 'AAL tekshirish');
    const factors = unwrap(await supabase.auth.mfa.listFactors(), 'Authenticator omillarini olish');
    const verifiedTotp = (factors?.totp || []).filter(f => f.status === 'verified');
    const required = MFA_REQUIRED_ROLES.has(role);

    if (aal?.currentLevel === 'aal2') {
      return { status: 'ready', role, aal: 'aal2', verifiedTotp };
    }
    if (aal?.nextLevel === 'aal2' || verifiedTotp.length > 0) {
      return { status: 'challenge_required', role, aal: 'aal1', verifiedTotp };
    }
    if (required) {
      return { status: 'setup_required', role, aal: 'aal1', verifiedTotp: [] };
    }
    return { status: 'ready', role, aal: aal?.currentLevel || 'aal1', verifiedTotp: [] };
  }

  async function signIn(email, password) {
    if (!email || !password) throw new Error('Email va parol kiritilishi kerak.');
    unwrap(await supabase.auth.signInWithPassword({ email, password }), 'Kirish');
    // IMPORTANT: An aal1 session must not open elevated MedGen screens.
    return getMfaState();
  }

  async function beginEnrollment() {
    const user = await currentUser();
    if (!user) throw new Error('Avval tizimga kiring.');
    const data = unwrap(
      await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'MedGen AI Authenticator' }),
      '2FA sozlash'
    );
    if (!data?.id || !data?.totp?.secret) throw new Error('Authenticator ma’lumoti kelmadi.');
    // Show QR/manual key ONLY to this currently authenticated user, in memory.
    // Do NOT persist these in cookies, storage, analytics, logs or databases.
    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri };
  }

  async function verifyEnrollment(factorId, code) {
    if (!factorId) throw new Error('Faktor ID topilmadi.');
    unwrap(await supabase.auth.mfa.challengeAndVerify({ factorId, code: validCode(code) }), 'Authenticator tasdiqlash');
    const gate = await getMfaState();
    if (gate.aal !== 'aal2') throw new Error('2FA tasdiqlangan sessiya olinmadi.');
    return gate;
  }

  async function verifyLogin(factorId, code) {
    const gate = await getMfaState();
    if (gate.status !== 'challenge_required') throw new Error('Hozir 2FA chaqiruvi talab qilinmayapti.');
    const selected = gate.verifiedTotp.find(f => f.id === factorId);
    if (!selected) throw new Error('Tasdiqlangan Authenticator topilmadi.');
    unwrap(await supabase.auth.mfa.challengeAndVerify({ factorId, code: validCode(code) }), '2FA login');
    const updated = await getMfaState();
    if (updated.aal !== 'aal2') throw new Error('2FA tasdiqlangan sessiya olinmadi.');
    return updated;
  }

  async function signOut() {
    unwrap(await supabase.auth.signOut(), 'Chiqish');
    return { status: 'signed_out' };
  }

  return { signIn, getMfaState, beginEnrollment, verifyEnrollment, verifyLogin, signOut };
}
