import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, hashPassword, invalidateUserCache } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { ESSENTIALS_PERMISSIONS, sanitizePermissions } from '@/lib/permissions';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (currentUser.role !== ROLES.SUPER_ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { name, email, role, isActive, password, permissions } = body;

    // Nobody can lock themselves out: no deactivating or demoting your own account
    if (id === currentUser.userId && (isActive === false || (role !== undefined && role !== ROLES.SUPER_ADMIN))) {
      return NextResponse.json(
        { error: 'You cannot deactivate or demote your own account. Ask another Developer to do it.' },
        { status: 400 }
      );
    }
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await prisma.user.findFirst({
        where: { email: normalizedEmail, NOT: { id } },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 409 }
        );
      }
      updateData.email = normalizedEmail;
    }

    if (role !== undefined) {
      const nextRole = role === ROLES.SUPER_ADMIN ? ROLES.SUPER_ADMIN : ROLES.MANAGER;
      updateData.role = nextRole;
      // SUPER_ADMIN ignores permissions entirely, so there's nothing meaningful to store. Demoting
      // to MANAGER needs *some* list decided now: whatever was just submitted, or Essentials as a
      // safe default rather than silently locking the account out of everything.
      updateData.permissions =
        nextRole === ROLES.SUPER_ADMIN ? [] : permissions !== undefined ? sanitizePermissions(permissions) : ESSENTIALS_PERMISSIONS;
    } else if (permissions !== undefined) {
      updateData.permissions = sanitizePermissions(permissions);
    }
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password && password.trim().length >= 8) {
      updateData.password = await hashPassword(password);
    } else if (password && password.trim().length > 0 && password.trim().length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
    });

    invalidateUserCache(id);
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'User not found or update failed' },
      { status: 404 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (currentUser.role !== ROLES.SUPER_ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  // Prevent self-deletion
  if (id === currentUser.userId) {
    return NextResponse.json(
      { error: 'Cannot delete your own active account' },
      { status: 400 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const soft = searchParams.get('soft') === 'true';

    if (soft) {
      const user = await prisma.user.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
        },
      });
      invalidateUserCache(id);
      return NextResponse.json({ user, deleted: false });
    }

    await prisma.user.delete({
      where: { id },
    });

    invalidateUserCache(id);
    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'User not found or deletion failed' },
      { status: 404 }
    );
  }
}
