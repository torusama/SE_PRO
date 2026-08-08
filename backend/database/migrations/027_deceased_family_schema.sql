ALTER TABLE plots
  ADD COLUMN IF NOT EXISTS deceased_profile_capacity SMALLINT
  CHECK (deceased_profile_capacity IS NULL OR deceased_profile_capacity > 0);

CREATE TABLE IF NOT EXISTS deceased_profiles (
  deceased_profile_id SERIAL PRIMARY KEY,
  plot_id INT NOT NULL REFERENCES plots(plot_id) ON DELETE RESTRICT,
  full_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  date_of_death DATE,
  burial_date DATE,
  avatar_url TEXT,
  hometown VARCHAR(255),
  biography TEXT,
  anniversary_month SMALLINT CHECK (anniversary_month BETWEEN 1 AND 12),
  anniversary_day SMALLINT CHECK (anniversary_day BETWEEN 1 AND 31),
  verification_status VARCHAR(30) NOT NULL DEFAULT 'pending_verification'
    CHECK (verification_status IN ('pending_verification','verified','rejected')),
  rejection_reason TEXT,
  reviewed_by INT REFERENCES users(user_id),
  reviewed_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by INT REFERENCES users(user_id),
  created_by INT NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_deceased_dates CHECK (
    (date_of_birth IS NULL OR date_of_death IS NULL OR date_of_death >= date_of_birth)
    AND (date_of_death IS NULL OR burial_date IS NULL OR burial_date >= date_of_death)
  ),
  CONSTRAINT chk_anniversary_pair CHECK (
    (anniversary_month IS NULL) = (anniversary_day IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_deceased_plot_active ON deceased_profiles(plot_id) WHERE is_deleted=FALSE;
CREATE INDEX IF NOT EXISTS idx_deceased_status_active ON deceased_profiles(verification_status) WHERE is_deleted=FALSE;
CREATE INDEX IF NOT EXISTS idx_deceased_name_active ON deceased_profiles(LOWER(full_name)) WHERE is_deleted=FALSE;

CREATE TABLE IF NOT EXISTS family_groups (
  family_id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  created_by INT NOT NULL REFERENCES users(user_id),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  disabled_at TIMESTAMPTZ,
  disabled_by INT REFERENCES users(user_id),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by INT REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS family_plots (
  family_plot_id SERIAL PRIMARY KEY,
  family_id INT NOT NULL REFERENCES family_groups(family_id) ON DELETE RESTRICT,
  plot_id INT NOT NULL REFERENCES plots(plot_id) ON DELETE RESTRICT,
  linked_by INT NOT NULL REFERENCES users(user_id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  unlinked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_plot_active_unique ON family_plots(family_id,plot_id) WHERE is_active=TRUE;

CREATE TABLE IF NOT EXISTS family_memberships (
  membership_id SERIAL PRIMARY KEY,
  family_id INT NOT NULL REFERENCES family_groups(family_id) ON DELETE RESTRICT,
  user_id INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  membership_role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (membership_role IN ('manager','member')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  removed_at TIMESTAMPTZ,
  removed_by INT REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_member_active_unique ON family_memberships(family_id,user_id) WHERE is_active=TRUE;

CREATE TABLE IF NOT EXISTS family_invitations (
  invitation_id SERIAL PRIMARY KEY,
  family_id INT NOT NULL REFERENCES family_groups(family_id) ON DELETE RESTRICT,
  inviter_user_id INT NOT NULL REFERENCES users(user_id),
  invitee_user_id INT NOT NULL REFERENCES users(user_id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','revoked','expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (inviter_user_id <> invitee_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_invite_pending_unique ON family_invitations(family_id,invitee_user_id) WHERE status='pending';

CREATE TABLE IF NOT EXISTS resource_permissions (
  permission_id SERIAL PRIMARY KEY,
  membership_id INT NOT NULL REFERENCES family_memberships(membership_id) ON DELETE RESTRICT,
  resource_type VARCHAR(30) NOT NULL CHECK (resource_type IN ('deceased_profile','plot','service_order')),
  resource_id INT NOT NULL,
  action VARCHAR(30) NOT NULL CHECK (action IN ('view_profile','view_plot','view_service_history','order_service')),
  granted_by INT NOT NULL REFERENCES users(user_id),
  revoked_at TIMESTAMPTZ,
  revoked_by INT REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_permission_active_unique
  ON resource_permissions(membership_id,resource_type,resource_id,action) WHERE revoked_at IS NULL;

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS deceased_profile_id INT REFERENCES deceased_profiles(deceased_profile_id) ON DELETE RESTRICT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS deceased_profile_id INT REFERENCES deceased_profiles(deceased_profile_id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_rem_deceased ON reminders(deceased_profile_id) WHERE deceased_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_so_deceased ON service_orders(deceased_profile_id) WHERE deceased_profile_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_deceased_profiles_updated_at ON deceased_profiles;
CREATE TRIGGER trg_deceased_profiles_updated_at BEFORE UPDATE ON deceased_profiles FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
DROP TRIGGER IF EXISTS trg_family_groups_updated_at ON family_groups;
CREATE TRIGGER trg_family_groups_updated_at BEFORE UPDATE ON family_groups FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
