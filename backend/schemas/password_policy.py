"""Shared password-strength check, used everywhere a user sets or changes
a password (staff signup/reset/change, tenant portal activate/reset).

Follows NIST SP 800-63B's actual guidance rather than the outdated
"must contain a symbol" rules that push people toward predictable
patterns like "Password1!": prioritize length, block the passwords most
commonly used in real credential-stuffing attacks, and require at least
some character variety so "aaaaaaaa" or "11111111" (8+ chars, would
otherwise pass) can't slip through.
"""
import re

# The passwords that show up over and over in real breach dumps and
# credential-stuffing attempts -- not exhaustive, just the ones cheap to
# check that stop the most common/laziest choices. Cloudflare's leaked-
# credential detection covers the login side; this covers the moment a
# password is first chosen.
COMMON_WEAK_PASSWORDS = {
    "password", "password1", "password123", "12345678", "123456789",
    "1234567890", "qwerty123", "qwertyui", "letmein1", "welcome1",
    "admin1234", "iloveyou1", "abc123456", "changeme1", "passw0rd",
    "12345678910", "football1", "baseball1", "trustno1", "starwars1",
}


def check_password_strength(password: str) -> "str | None":
    """Returns an error message if the password is too weak, or None if
    it's acceptable."""
    if len(password) < 8:
        return "Password must be at least 8 characters."

    lowered = password.lower()
    if lowered in COMMON_WEAK_PASSWORDS:
        return "That password is too common and appears in known password-breach lists. Please choose a different one."

    # Require at least two of: lowercase, uppercase, digit, symbol -- not
    # "must have a symbol" specifically (that's the pattern that produces
    # predictable "Word1!" passwords), just enough variety to rule out a
    # single repeated character or a bare dictionary word.
    classes_present = sum([
        bool(re.search(r"[a-z]", password)),
        bool(re.search(r"[A-Z]", password)),
        bool(re.search(r"\d", password)),
        bool(re.search(r"[^a-zA-Z0-9]", password)),
    ])
    if classes_present < 2:
        return "Password is too simple. Mix in at least one more character type (uppercase, number, or symbol)."

    # Catches "aaaaaaaa", "abababab", etc. -- a password that's almost
    # entirely one or two repeating characters despite technically having
    # enough length and character-class variety.
    if len(set(password)) <= 3:
        return "Password has too little variety. Please choose something less repetitive."

    return None
