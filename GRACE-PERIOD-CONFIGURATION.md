# 🕐 GRACE PERIOD & AUTO-RENEWAL CONFIGURATION

## 📋 Penjelasan Grace Period

**Grace Period** adalah **masa tenggang** yang diberikan kepada user ketika auto-renewal gagal karena credit tidak cukup.

### 🔄 Dua Mode Operasi

#### **Mode 1: Grace Period ENABLED** (Default)

```bash
GRACE_PERIOD_ENABLED=true
```

**Behavior:**

- Renewal gagal → User dapat grace period 7 hari
- Service tetap jalan selama grace period
- User dapat daily reminders untuk top-up
- Setelah 7 hari masih kurang credit → Service di-suspend

#### **Mode 2: Grace Period DISABLED** (Strict)

```bash
GRACE_PERIOD_ENABLED=false
```

**Behavior:**

- Renewal gagal → Service langsung di-suspend
- Tidak ada grace period
- Tidak ada daily reminders
- User harus reactive subscription manual

## ⚙️ Konfigurasi Environment Variables

### **File: `.env`** (Sudah di-update)

```bash
# Auto-Renewal System Configuration
# Grace period settings
GRACE_PERIOD_ENABLED=true          # Enable/disable grace period
GRACE_PERIOD_DAYS=7                # Default grace period duration
GRACE_PERIOD_MIN_DAYS=1            # Minimum grace period (admin limit)
GRACE_PERIOD_MAX_DAYS=30           # Maximum grace period (admin limit)

# Low credit notification settings
LOW_CREDIT_WARNING_DAYS=3          # Warning berapa hari sebelum renewal
LOW_CREDIT_WARNING_ENABLED=true    # Enable/disable low credit warnings

# Scheduled job configuration (cron format)
CRON_DAILY_RENEWALS="0 2 * * *"           # Auto-renewal: 2:00 AM daily
CRON_GRACE_PERIOD="0 3 * * *"             # Grace period check: 3:00 AM daily
CRON_LOW_CREDIT_NOTIFICATIONS="0 9 * * *" # Low credit warnings: 9:00 AM daily
CRON_GRACE_PERIOD_REMINDERS="0 18 * * *"  # Grace reminders: 6:00 PM daily
CRON_BILLING_STATS="0 23 * * *"           # Billing stats: 11:00 PM daily

# Timezone for scheduled jobs
BILLING_TIMEZONE="Asia/Jakarta"     # Timezone untuk semua scheduled jobs

# Auto-renewal system settings
AUTO_RENEWAL_ENABLED=true          # Enable/disable entire auto-renewal system
BILLING_RETRY_ATTEMPTS=3           # Retry attempts for failed operations
BILLING_RETRY_DELAY_MINUTES=30     # Delay between retry attempts
```

## 🎯 Skenario Konfigurasi

### **Skenario 1: Grace Period Aktif (Recommended)**

```bash
GRACE_PERIOD_ENABLED=true
GRACE_PERIOD_DAYS=7
LOW_CREDIT_WARNING_DAYS=3
```

**Timeline:**

- **Hari -3**: Low credit warning dikirim
- **Hari 0**: Renewal gagal → Grace period 7 hari dimulai
- **Hari 1-6**: Daily reminders dikirim
- **Hari 7**: Jika masih kurang → Suspend

### **Skenario 2: Grace Period Disabled (Strict)**

```bash
GRACE_PERIOD_ENABLED=false
LOW_CREDIT_WARNING_DAYS=5
```

**Timeline:**

- **Hari -5**: Low credit warning dikirim
- **Hari 0**: Renewal gagal → Service langsung di-suspend

### **Skenario 3: Grace Period Panjang (Liberal)**

```bash
GRACE_PERIOD_ENABLED=true
GRACE_PERIOD_DAYS=14
LOW_CREDIT_WARNING_DAYS=7
```

**Timeline:**

- **Hari -7**: Low credit warning dikirim
- **Hari 0**: Renewal gagal → Grace period 14 hari dimulai
- **Hari 1-13**: Daily reminders dikirim
- **Hari 14**: Jika masih kurang → Suspend

## 🔧 Implementasi di Code

### **Billing Service Logic**

```javascript
// Di processAutoRenewals()
if (error.message.includes("Insufficient credit")) {
  if (GRACE_PERIOD_ENABLED) {
    // Mode 1: Set grace period
    await setGracePeriod(subscription.id, GRACE_PERIOD_DAYS);
    logger.info(`Grace period of ${GRACE_PERIOD_DAYS} days set`);
  } else {
    // Mode 2: Suspend immediately
    await suspendSubscription(subscription.id);
    logger.info(`Subscription suspended immediately (grace period disabled)`);
  }
}
```

### **Admin Validation**

```javascript
// Grace period validation menggunakan env limits
if (graceDays < GRACE_PERIOD_MIN_DAYS || graceDays > GRACE_PERIOD_MAX_DAYS) {
  throw new Error(
    `Grace period must be between ${GRACE_PERIOD_MIN_DAYS} and ${GRACE_PERIOD_MAX_DAYS} days`
  );
}
```

## 📅 Scheduled Jobs Configuration

### **Cron Expression Examples**

```bash
# Setiap hari jam 2:00 AM
CRON_DAILY_RENEWALS="0 2 * * *"

# Setiap hari jam 1:30 AM
CRON_DAILY_RENEWALS="30 1 * * *"

# Setiap 6 jam (jam 0, 6, 12, 18)
CRON_DAILY_RENEWALS="0 */6 * * *"

# Hanya hari kerja (Senin-Jumat) jam 2:00 AM
CRON_DAILY_RENEWALS="0 2 * * 1-5"

# Testing: Setiap 5 menit
CRON_DAILY_RENEWALS="*/5 * * * *"
```

### **Timezone Options**

```bash
BILLING_TIMEZONE="Asia/Jakarta"      # WIB (UTC+7)
BILLING_TIMEZONE="UTC"               # UTC (UTC+0)
BILLING_TIMEZONE="America/New_York"  # EST (UTC-5)
BILLING_TIMEZONE="Europe/London"     # GMT (UTC+0)
```

## 🎮 Admin Controls

### **Admin Dapat Override Grace Period**

```bash
# Via admin endpoint
POST /api/admin/billing/set-grace-period/:subscriptionId
{
  "graceDays": 14  # Override default, tapi tetap dalam range min-max
}
```

### **Admin Dapat Disable Grace Period per Subscription**

```bash
# Via admin update endpoint
PUT /api/admin/subscriptions/:subscriptionId
{
  "gracePeriodEnd": null  # Clear grace period manual
}
```

## 📊 Monitoring Configuration

### **Check Current Configuration**

```bash
# Via admin endpoint
GET /api/admin/billing/job-status

# Response akan show:
{
  "isRunning": true,
  "activeJobs": ["daily-renewals", "grace-period", ...],
  "configuration": {
    "gracePeriodEnabled": true,
    "gracePeriodDays": 7,
    "timezone": "Asia/Jakarta"
  }
}
```

### **Test Configuration**

```bash
# Test manual job execution
POST /api/admin/billing/run-job/billing-stats

# Check logs untuk melihat configuration yang diload
tail -f logs/app.log | grep "Scheduled jobs configuration"
```

## 🚨 Important Notes

### **1. Restart Required**

Perubahan environment variables memerlukan restart aplikasi:

```bash
npm restart
# atau jika pakai PM2
pm2 restart app
```

### **2. Validation**

Sistem akan validate semua environment variables saat startup:

- Grace period days harus dalam range min-max
- Cron expressions harus valid
- Timezone harus valid

### **3. Fallback Values**

Jika environment variable tidak di-set, sistem akan gunakan default values:

- `GRACE_PERIOD_ENABLED=true`
- `GRACE_PERIOD_DAYS=7`
- `LOW_CREDIT_WARNING_DAYS=3`
- `BILLING_TIMEZONE="Asia/Jakarta"`

## 💡 Rekomendasi Konfigurasi

### **Production (Recommended)**

```bash
GRACE_PERIOD_ENABLED=true
GRACE_PERIOD_DAYS=7
LOW_CREDIT_WARNING_DAYS=3
CRON_DAILY_RENEWALS="0 2 * * *"
BILLING_TIMEZONE="Asia/Jakarta"
```

### **Strict Business (No Grace Period)**

```bash
GRACE_PERIOD_ENABLED=false
LOW_CREDIT_WARNING_DAYS=5
CRON_DAILY_RENEWALS="0 1 * * *"
```

### **Development/Testing**

```bash
GRACE_PERIOD_ENABLED=true
GRACE_PERIOD_DAYS=1
CRON_DAILY_RENEWALS="*/10 * * * *"  # Setiap 10 menit untuk testing
```

## 🔄 Cara Mengubah Konfigurasi

### **1. Edit .env file**

```bash
# Disable grace period
GRACE_PERIOD_ENABLED=false

# Ubah grace period ke 14 hari
GRACE_PERIOD_DAYS=14

# Ubah schedule ke jam 1 AM
CRON_DAILY_RENEWALS="0 1 * * *"
```

### **2. Restart aplikasi**

```bash
npm restart
```

### **3. Verify via admin endpoint**

```bash
GET /api/admin/billing/job-status
```

Dengan konfigurasi ini, Anda memiliki kontrol penuh atas:

- **Apakah menggunakan grace period atau tidak**
- **Berapa lama grace period**
- **Kapan scheduled jobs dijalankan**
- **Timezone untuk semua operations**

Sistem akan otomatis menyesuaikan behavior berdasarkan konfigurasi yang Anda set di `.env` file.
