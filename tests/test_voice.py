"""Spoken prompts: never repeats itself, never overlaps, silent when off or unavailable."""

import unittest

from tracker.voice import Voice


class FakeProc:
    def __init__(self, cmd):
        self.cmd, self.alive, self.terminated = cmd, True, False

    def poll(self):
        return None if self.alive else 0

    def terminate(self):
        self.alive, self.terminated = False, True


class Rig:
    def __init__(self, enabled=True):
        self.now, self.procs = 0.0, []

        def popen(cmd, **kw):
            p = FakeProc(cmd)
            self.procs.append(p)
            return p
        self.voice = Voice(enabled=enabled, command=["say", "-r", "175"], popen=popen, clock=lambda: self.now)

    def spoken(self):
        return [p.cmd[-1] for p in self.procs]


class VoiceTests(unittest.TestCase):
    def test_speaks_a_new_sentence_once(self):
        r = Rig()
        for _ in range(30):                       # the same message arrives every camera frame
            r.voice.say("Bend your knees.")
        self.assertEqual(r.spoken(), ["Bend your knees."])
        self.assertEqual(r.procs[0].cmd[:3], ["say", "-r", "175"])

    def test_off_means_silent(self):
        r = Rig(enabled=False)
        r.voice.say("Hello.")
        self.assertEqual(r.spoken(), [])

    def test_toggle(self):
        r = Rig(enabled=False)
        self.assertTrue(r.voice.toggle())
        r.voice.say("Hello.")
        self.assertEqual(r.spoken(), ["Hello."])
        self.assertFalse(r.voice.toggle())
        self.assertTrue(r.procs[0].terminated)    # turning it off cuts the sentence short

    def test_newest_message_replaces_the_one_still_speaking(self):
        r = Rig()
        r.voice.say("One.")
        r.voice.say("Two.")
        self.assertTrue(r.procs[0].terminated)
        self.assertEqual(r.spoken(), ["One.", "Two."])

    def test_none_resets_so_the_same_sentence_can_come_back(self):
        r = Rig()
        r.voice.say("I can't see you.")
        r.voice.say(None)
        r.now = 1.0
        r.voice.say("I can't see you.")          # flicker within 4 s: not repeated
        self.assertEqual(len(r.procs), 1)
        r.voice.say(None)
        r.now = 10.0
        r.voice.say("I can't see you.")          # much later: spoken again
        self.assertEqual(len(r.procs), 2)

    def test_no_speech_command_stays_off_and_does_not_crash(self):
        v = Voice(enabled=True, command=None)
        v.command = None
        v.unavailable, v.enabled = True, False
        v.say("Hello.")
        self.assertFalse(v.toggle())

    def test_a_failing_command_turns_the_voice_off(self):
        def boom(*a, **k):
            raise OSError("no such command")
        v = Voice(enabled=True, command=["say"], popen=boom)
        v.say("Hello.")
        self.assertFalse(v.enabled)
        self.assertTrue(v.unavailable)


if __name__ == "__main__":
    unittest.main()
