import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLUS_ITEM_ID, getCosmetic } from "@/lib/cosmetics";

const MAX_AVATAR_DATA_URL_LENGTH = 400_000; // client resizes to 256x256 JPEG first, well under this
const MAX_BANNER_DATA_URL_LENGTH = 700_000; // wider aspect ratio, slightly bigger cap
// Animated GIFs skip the resize step (so they keep their animation), so they
// need a much bigger cap — only reachable by Plus members, checked below.
const MAX_AVATAR_GIF_DATA_URL_LENGTH = 2_500_000;
const MAX_BANNER_GIF_DATA_URL_LENGTH = 3_500_000;
const STATIC_IMAGE_DATA_URL_PATTERN = /^data:image\/(jpeg|png|webp);base64,/;
const GIF_DATA_URL_PATTERN = /^data:image\/gif;base64,/;
const MAX_BIO_LENGTH = 190;
const MAX_PRONOUNS_LENGTH = 30;
const MAX_PROFILE_NOTE_LENGTH = 60;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const owned: string[] = user.unlockedCosmetics ? JSON.parse(user.unlockedCosmetics) : [];
  const hasPlus = owned.includes(PLUS_ITEM_ID);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  function validateImage(value: unknown, maxStaticLength: number, maxGifLength: number): string | null | undefined {
    if (value === null) return null;
    if (typeof value !== "string") return undefined;
    if (GIF_DATA_URL_PATTERN.test(value)) {
      if (!hasPlus) return undefined;
      if (value.length > maxGifLength) return undefined;
      return value;
    }
    if (STATIC_IMAGE_DATA_URL_PATTERN.test(value) && value.length <= maxStaticLength) {
      return value;
    }
    return undefined;
  }

  const data: {
    displayName?: string | null;
    avatarDataUrl?: string | null;
    bannerDataUrl?: string | null;
    bio?: string | null;
    pronouns?: string | null;
    profileNote?: string | null;
    accentColor?: string | null;
    pinnedCosmeticId?: string | null;
  } = {};

  if ("displayName" in body) {
    const trimmed = typeof body.displayName === "string" ? body.displayName.trim() : "";
    if (trimmed.length === 0 || trimmed.length > 40) {
      return NextResponse.json({ error: "Username must be 1-40 characters." }, { status: 400 });
    }
    data.displayName = trimmed;
  }

  if ("avatarDataUrl" in body) {
    const result = validateImage(body.avatarDataUrl, MAX_AVATAR_DATA_URL_LENGTH, MAX_AVATAR_GIF_DATA_URL_LENGTH);
    if (result === undefined) {
      return NextResponse.json(
        { error: hasPlus ? "Invalid photo." : "Animated GIF avatars need Game Hub Plus." },
        { status: 400 }
      );
    }
    data.avatarDataUrl = result;
  }

  if ("bannerDataUrl" in body) {
    const result = validateImage(body.bannerDataUrl, MAX_BANNER_DATA_URL_LENGTH, MAX_BANNER_GIF_DATA_URL_LENGTH);
    if (result === undefined) {
      return NextResponse.json(
        { error: hasPlus ? "Invalid banner image." : "Animated GIF banners need Game Hub Plus." },
        { status: 400 }
      );
    }
    data.bannerDataUrl = result;
  }

  if ("bio" in body) {
    if (body.bio === null) {
      data.bio = null;
    } else if (typeof body.bio === "string" && body.bio.length <= MAX_BIO_LENGTH) {
      data.bio = body.bio.trim() || null;
    } else {
      return NextResponse.json({ error: `Bio must be ${MAX_BIO_LENGTH} characters or fewer.` }, { status: 400 });
    }
  }

  if ("pronouns" in body) {
    if (body.pronouns === null) {
      data.pronouns = null;
    } else if (typeof body.pronouns === "string" && body.pronouns.length <= MAX_PRONOUNS_LENGTH) {
      data.pronouns = body.pronouns.trim() || null;
    } else {
      return NextResponse.json({ error: `Pronouns must be ${MAX_PRONOUNS_LENGTH} characters or fewer.` }, { status: 400 });
    }
  }

  if ("profileNote" in body) {
    if (body.profileNote === null) {
      data.profileNote = null;
    } else if (typeof body.profileNote === "string" && body.profileNote.length <= MAX_PROFILE_NOTE_LENGTH) {
      data.profileNote = body.profileNote.trim() || null;
    } else {
      return NextResponse.json(
        { error: `Note must be ${MAX_PROFILE_NOTE_LENGTH} characters or fewer.` },
        { status: 400 }
      );
    }
  }

  if ("accentColor" in body) {
    if (!hasPlus) {
      return NextResponse.json({ error: "A custom profile color needs Game Hub Plus." }, { status: 400 });
    }
    if (body.accentColor === null) {
      data.accentColor = null;
    } else if (typeof body.accentColor === "string" && HEX_COLOR_PATTERN.test(body.accentColor)) {
      data.accentColor = body.accentColor;
    } else {
      return NextResponse.json({ error: "Invalid color." }, { status: 400 });
    }
  }

  if ("pinnedCosmeticId" in body) {
    if (body.pinnedCosmeticId === null) {
      data.pinnedCosmeticId = null;
    } else if (typeof body.pinnedCosmeticId === "string" && getCosmetic(body.pinnedCosmeticId) && owned.includes(body.pinnedCosmeticId)) {
      data.pinnedCosmeticId = body.pinnedCosmeticId;
    } else {
      return NextResponse.json({ error: "You don't own that item." }, { status: 400 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: {
      displayName: true,
      avatarDataUrl: true,
      bannerDataUrl: true,
      bio: true,
      pronouns: true,
      profileNote: true,
      accentColor: true,
      pinnedCosmeticId: true,
    },
  });

  return NextResponse.json(updated);
}
