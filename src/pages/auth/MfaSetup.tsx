import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";
import { associate, otpauthUri, prefer, verify } from "../../auth/mfa";
import { signOut } from "../../auth/signOut";
import { useConfig } from "../../ConfigContext";
import EnvBadge from "../../components/EnvBadge";

interface Props {
  email: string;
}

type Stage = "intro" | "enrolling" | "ready" | "verified" | "error";

export default function MfaSetup({ email }: Props) {
  const { userManager } = useAuth();
  const config = useConfig();
  const [stage, setStage] = useState<Stage>("intro");
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!otpauth) return;
    let cancelled = false;
    QRCode.toDataURL(otpauth)
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [otpauth]);

  const beginEnroll = async () => {
    setError(null);
    setStage("enrolling");
    try {
      const user = await userManager.getUser();
      const accessToken = user?.access_token;
      if (!accessToken) throw new Error("Access token unavailable");
      const { SecretCode } = await associate(config, accessToken);
      setSecret(SecretCode);
      setOtpauth(otpauthUri(SecretCode, email));
      setStage("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("error");
    }
  };

  const submitCode = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const user = await userManager.getUser();
      const accessToken = user?.access_token;
      if (!accessToken) throw new Error("Access token unavailable");
      const { Status } = await verify(config, accessToken, code.trim());
      if (Status !== "SUCCESS") throw new Error("Verification failed");
      await prefer(config, accessToken);
      setStage("verified");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="h5" component="h1">
              Set up MFA
            </Typography>
            <EnvBadge />
          </Box>
          <Typography variant="body1">
            Signed in as <strong>{email}</strong>. TOTP is not enabled on this
            account. Enrol an authenticator to continue.
          </Typography>

          {error !== null && <Alert severity="error">{error}</Alert>}

          {stage === "intro" && (
            <Button variant="contained" onClick={beginEnroll}>
              Start enrolment
            </Button>
          )}

          {stage === "enrolling" && (
            <Typography variant="body2">Contacting Cognito…</Typography>
          )}

          {stage === "ready" && secret && otpauth && (
            <Stack spacing={2}>
              <Typography variant="body2">
                Scan this QR code with your authenticator, or paste the secret
                below.
              </Typography>
              {qrDataUrl && (
                <Box sx={{ display: "flex", justifyContent: "center" }}>
                  <img src={qrDataUrl} alt="TOTP QR code" width={200} height={200} />
                </Box>
              )}
              <TextField
                label="otpauth URI"
                value={otpauth}
                InputProps={{ readOnly: true }}
                fullWidth
                multiline
              />
              <TextField
                label="Six-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              />
              <Button
                variant="contained"
                onClick={submitCode}
                disabled={submitting || code.trim().length < 6}
              >
                Verify
              </Button>
            </Stack>
          )}

          {stage === "verified" && (
            <Alert severity="success">
              MFA is now enabled. Sign out and sign in again; the API re-checks
              MFA status every five minutes.
            </Alert>
          )}

          <Button variant="outlined" onClick={() => signOut(userManager, config)}>
            Sign out
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
