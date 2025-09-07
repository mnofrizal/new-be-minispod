# Welcome Bonus System Documentation

## Overview

The Welcome Bonus System automatically applies promotional coupons to new users during registration. This system leverages the existing coupon infrastructure to provide flexible, manageable welcome bonuses that can be easily enabled, disabled, or modified by administrators.

## Key Features

- **Automatic Application**: Welcome bonuses are automatically applied during user registration
- **Multiple Coupons**: System can apply multiple welcome bonus coupons to a single user
- **Admin Controlled**: Fully managed through existing coupon admin system
- **Flexible Configuration**: Supports time limits, usage limits, and amount customization
- **Graceful Fallback**: Registration continues normally even if welcome bonus fails
- **Comprehensive Tracking**: Full audit trail through coupon redemption system

## Architecture

### Database Schema

The system uses the existing coupon infrastructure with a new coupon type:

```prisma
enum CouponType {
  CREDIT_TOPUP
  SUBSCRIPTION_DISCOUNT
  FREE_SERVICE
  WELCOME_BONUS // New type for automatic welcome bonuses
}
```

### Core Components

1. **Welcome Bonus Service** ([`src/services/welcomeBonus.service.js`](src/services/welcomeBonus.service.js))

   - `applyWelcomeBonuses()` - Main function to apply all eligible welcome bonuses
   - `getWelcomeBonusStats()` - Statistics and analytics for welcome bonuses

2. **Integration Points**:
   - [`src/services/auth.service.js`](src/services/auth.service.js) - Integrated into both regular and Google OAuth registration
   - [`src/validations/coupon.validation.js`](src/validations/coupon.validation.js) - Updated to support WELCOME_BONUS type
   - Existing coupon admin system for management

## How It Works

### Registration Flow

```
User Registration → User Created → Check for Active Welcome Bonus Coupons → Apply All Eligible Coupons → Update User Balance → Complete Registration
```

### Welcome Bonus Application Logic

1. **Find Active Coupons**: Search for all `WELCOME_BONUS` coupons with status `ACTIVE`
2. **Filter by Availability**: Only include coupons that:
   - Are not expired (`validUntil` is null or in the future)
   - Have remaining uses (`usedCount < maxUses`)
3. **Check User Eligibility**: For each coupon, verify:
   - User hasn't already redeemed this coupon
   - Coupon still has available uses
4. **Apply Coupons**: Use existing `couponService.redeemCreditTopupCoupon()` method
5. **Update Balance**: User's credit balance is automatically updated
6. **Continue Registration**: Process continues even if some coupons fail

## Admin Management

### Creating Welcome Bonus Coupons

Admins can create welcome bonus coupons using the existing coupon admin endpoints:

```http
POST /api/admin/coupons
Content-Type: application/json
Authorization: Bearer <admin-token>

{
  "code": "WELCOME2025",
  "name": "Welcome Bonus 2025",
  "description": "Welcome bonus for new users - IDR 20,000 credit",
  "type": "WELCOME_BONUS",
  "creditAmount": 20000,
  "maxUses": 1000,
  "maxUsesPerUser": 1,
  "validUntil": "2025-12-31T23:59:59.000Z"
}
```

### Managing Welcome Bonuses

**Enable/Disable Welcome Bonuses:**

```http
PUT /api/admin/coupons/WELCOME2025
{
  "status": "ACTIVE"    // or "DISABLED"
}
```

**Adjust Bonus Amount:**

```http
PUT /api/admin/coupons/WELCOME2025
{
  "creditAmount": 30000,
  "description": "Updated welcome bonus - IDR 30,000 credit"
}
```

**Set Usage Limits:**

```http
PUT /api/admin/coupons/WELCOME2025
{
  "maxUses": 500,
  "validUntil": "2025-06-30T23:59:59.000Z"
}
```

### Multiple Welcome Bonuses

Admins can create multiple welcome bonus coupons that will all be applied to new users:

```json
// Example: User gets both bonuses = IDR 25,000 total
[
  {
    "code": "WELCOME2025",
    "creditAmount": 20000,
    "status": "ACTIVE"
  },
  {
    "code": "NEWUSER5K",
    "creditAmount": 5000,
    "status": "ACTIVE"
  }
]
```

## Configuration Options

### Coupon Properties for Welcome Bonuses

- **`code`**: Unique identifier (e.g., "WELCOME2025")
- **`name`**: Display name for admin interface
- **`description`**: Description of the bonus
- **`type`**: Must be "WELCOME_BONUS"
- **`status`**: "ACTIVE" to enable, "DISABLED" to disable
- **`creditAmount`**: Amount in IDR (required for welcome bonuses)
- **`maxUses`**: Total number of users who can receive this bonus
- **`maxUsesPerUser`**: Always 1 for welcome bonuses (one per user)
- **`validFrom`**: When the bonus becomes active (optional)
- **`validUntil`**: When the bonus expires (optional)

### Business Rules

1. **One Per User**: Each user can only redeem each welcome bonus coupon once
2. **Automatic Application**: No user action required - applied during registration
3. **Multiple Bonuses**: Users receive all eligible welcome bonus coupons
4. **Usage Limits**: Coupons become unavailable when `maxUses` is reached
5. **Time Limits**: Coupons respect `validFrom` and `validUntil` dates
6. **Graceful Failure**: Registration succeeds even if welcome bonus fails

## API Integration

### Registration Response

When welcome bonuses are applied, the registration response includes the updated credit balance:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "name": "User Name",
      "role": "USER",
      "phone": null,
      "avatar": null,
      "creditBalance": 25000, // Includes welcome bonuses
      "totalTopUp": 25000, // Welcome bonuses count as top-up
      "totalSpent": 0
    },
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token"
  }
}
```

### Transaction Records

Welcome bonus applications create transaction records:

- **Type**: `COUPON_REDEMPTION`
- **Description**: Includes coupon code and "Welcome bonus" text
- **Amount**: Credit amount from the coupon
- **Custom ID**: Standard TXMP-XXX format

## Testing

### Test Scenarios

Use the provided test suite in [`rest/welcome-bonus.rest`](rest/welcome-bonus.rest):

1. **Basic Functionality**:

   - Create welcome bonus coupons
   - Test registration with active bonuses
   - Verify credit balance updates

2. **Enable/Disable Control**:

   - Disable welcome bonuses
   - Test registration (should get no bonus)
   - Re-enable bonuses

3. **Usage Limits**:

   - Set low usage limits
   - Test multiple registrations
   - Verify limits are enforced

4. **Expiration**:

   - Create expired coupons
   - Verify they're not applied

5. **Multiple Bonuses**:

   - Create multiple active welcome bonuses
   - Verify all are applied to new users

6. **Error Handling**:
   - Test with invalid coupon data
   - Verify registration continues on failure

### Sample Test Data

Create sample welcome bonus coupons using the seed script:

```bash
node prisma/seed-welcome-bonus.js
```

This creates:

- `WELCOME2025`: IDR 20,000 (Active, 1000 uses)
- `NEWUSER5K`: IDR 5,000 (Active, 500 uses)
- `DISABLED_WELCOME`: IDR 10,000 (Disabled - won't be applied)

## Monitoring and Analytics

### Admin Endpoints

**List Welcome Bonus Coupons:**

```http
GET /api/admin/coupons?type=WELCOME_BONUS
```

**View Coupon Statistics:**

```http
GET /api/admin/coupons/stats
```

**Check Specific Coupon:**

```http
GET /api/admin/coupons/WELCOME2025
```

### Key Metrics to Monitor

1. **Redemption Rate**: How many new users receive welcome bonuses
2. **Total Credit Given**: Sum of all welcome bonus credits distributed
3. **Coupon Usage**: Track which coupons are most/least used
4. **Failure Rate**: Monitor welcome bonus application failures
5. **User Retention**: Compare retention between users with/without bonuses

## Troubleshooting

### Common Issues

1. **Welcome Bonus Not Applied**:

   - Check coupon status (must be "ACTIVE")
   - Verify coupon hasn't reached `maxUses` limit
   - Check expiration date (`validUntil`)
   - Review server logs for errors

2. **Partial Bonus Application**:

   - Some coupons may fail while others succeed
   - Check individual coupon limits and validity
   - Review error logs for specific failures

3. **Validation Errors When Creating Coupons**:
   - Ensure `type` is "WELCOME_BONUS"
   - Include required `creditAmount` field
   - Verify date formats for `validUntil`

### Debug Information

Enable detailed logging by checking the application logs:

```bash
# Look for welcome bonus related logs
grep "welcome bonus" logs/app.log
grep "Checking welcome bonuses" logs/app.log
```

## Security Considerations

1. **Admin Only**: Only administrators can create/modify welcome bonus coupons
2. **One Per User**: System prevents duplicate redemptions per user
3. **Usage Limits**: Prevents unlimited bonus distribution
4. **Audit Trail**: All redemptions are logged with full transaction records
5. **Graceful Failure**: System doesn't expose internal errors to users

## Future Enhancements

Potential improvements to consider:

1. **Conditional Bonuses**: Based on registration source, referrals, etc.
2. **Tiered Bonuses**: Different amounts based on user attributes
3. **Time-Based Bonuses**: Different bonuses for different time periods
4. **Geographic Bonuses**: Location-based welcome bonuses
5. **A/B Testing**: Support for testing different bonus amounts
6. **Email Notifications**: Notify users about received bonuses

## Best Practices

1. **Monitor Usage**: Regularly check coupon usage and adjust limits
2. **Set Expiration Dates**: Prevent indefinite bonus programs
3. **Test Changes**: Always test coupon changes in development first
4. **Track Performance**: Monitor the impact of bonuses on user behavior
5. **Budget Control**: Set appropriate usage limits to control costs
6. **Clear Naming**: Use descriptive coupon codes and names
7. **Documentation**: Keep track of active bonus campaigns

## Integration with Existing Systems

The welcome bonus system seamlessly integrates with:

- **Coupon Management**: Uses existing admin coupon endpoints
- **Credit System**: Leverages existing credit/wallet infrastructure
- **Transaction System**: Creates standard transaction records
- **User Registration**: Works with both regular and Google OAuth registration
- **Analytics**: Data available through existing coupon analytics
- **Audit System**: Full audit trail through coupon redemption records

This design ensures consistency with existing systems while providing powerful welcome bonus functionality.
