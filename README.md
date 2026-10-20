# LarpCord

Client-side **badges** + **custom username / display name** for Kettu (iOS/Android).

> **Only you can see these.** Other people still see your real name and real badges.

## How it works

Classic BetterDiscord badge plugins (e.g. [John-Fries-J/Badges-plugin](https://github.com/John-Fries-J/Badges-plugin)) set Discord **user flags** on your local user object so the client draws the real badge icons.

LarpCord does the same on Kettu:

- Continuous `UserStore` / `UserProfileStore` patches
- Optional fake `username` + `globalName` / display name
- Toggle each badge (Staff, Partner, gold Bug Hunter, Early Dev, etc.)

## Install

```
https://cdn.jsdelivr.net/gh/unemployedz/larpcord@main/dist/
```

1. Plugins → install URL → enable **LarpCord**
2. Open plugin settings
3. Set fake username / display name (optional)
4. Toggle badges
5. Tap **Apply** → open **your profile** again

## Notes

- Client-side only (larp)
- Reopen profile after changing toggles
- Mobile Discord may cache names in some places (member list vs profile)

## License

MIT
