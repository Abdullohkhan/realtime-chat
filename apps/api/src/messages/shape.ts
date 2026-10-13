export const MESSAGE_INCLUDE = {
  replyTo: true,
  reactions: { include: { user: { select: { username: true } } } },
} as const;

export type JwtUser = { sub: number; username: string };

export function groupReactions(list: { emoji: string; user: { username: string } }[] = []) {
  const out: Record<string, string[]> = {};
  for (const r of list) (out[r.emoji] ??= []).push(r.user.username);
  return out;
}

export function shapeMessage(m: any) {
  return {
    id: m.id,
    text: m.text,
    username: m.username,
    country: m.country,
    isAuthenticated: m.userId != null,
    createdAt: m.createdAt,
    imageUrl: m.imageId ? `/uploads/${m.imageId}` : null,
    replyTo: m.replyTo
      ? { id: m.replyTo.id, username: m.replyTo.username, text: m.replyTo.text.slice(0, 120), hasImage: !!m.replyTo.imageId }
      : null,
    reactions: groupReactions(m.reactions),
  };
}
