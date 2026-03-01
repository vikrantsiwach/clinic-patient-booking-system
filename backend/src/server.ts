import app from './app';
import env from './config/env';

app.listen(env.PORT, () => {
  console.log(`\n🏥 Clinic API running on http://localhost:${env.PORT}`);
  console.log(`   ENV: ${env.NODE_ENV}`);
  console.log(`   SMS: ${env.SMS_MOCK ? '📱 MOCK (logs to console)' : '📡 MSG91 Live'}`);
  console.log(`   DB:  ${env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}\n`);
});
