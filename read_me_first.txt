WOW MACHINE SETTINGS USER MANUAL

In wow_settings.txt, varies settings can be modified to suit personal needs.

Edit wow_setting.txt, DO NOT edit this read_me.txt

ONLY change the value AFTER the equal sign "=", DO NOT edit anything before that.

-----

fader_left = sample
fader_right = sample

Can be changed to cut "beat", "sample" or "none" (default = "sample")

-----

left_cut_value = 3599
right_cut_value = 3869

These value are auto generated when you do fader calibration, edit a larger value (+30 for example) will give more lag

-----

33rpm_value = 400

Set the 33RPM speed when the pitch knob is centred, higher value gives higher rpm. (Default factory calibrated)

-----

pitch_range_min = 50
pitch_range_max	= 50

Pitch knob range in %, value can be from "1" to "100" (default min = 50, max = 50)

-----

wheel_response = 8

Jog wheel response value, can be set from 1" to "10", 1 has better audio quality, 10 has faster responds (default = "8")

-----

sample_high_pass_frequency = 10

Scratch sample high pass filter in Hz, can be set to "10" to "20000" (default = "10" = disable)

-----

effect_mode = both

Set what effect to be enabled when effect mode is on, can be "off" or "reverb" or "delay" or "both" (default = "both", disable all effect = "off")

-----

delay_length = 0.5

Set the delay effect length in seconds (default = "0.5") 

-----

delay_strength = 2

Set the delay effect strength "1" to "10" (default = "2")

-----

reverb_roomsize = 1

Set the reverb effect roomsize, can be "1" to "10" (default = "1") 

-----

reverb_strength = 7

Set the reverb strength "1" to "10" (default = "7")

-----

reverb_damping = 5

Set the reverb damping "1" to "10" (default = "5")

-----

reverb_tone_low_pass_hz = 400

Set the reverb tone, low pass filter in Hz, can be "20" to "20000" (default = "400")

-----

looper_mode = no

Looper Mode **Beta** to be updated in future firmware.
Enable the looper_mode, enable = "yes" (default = "no")

-----

fader_calibrate_lag = 50

Edit the lag distance of fader auto calibration, high value = more lag. (Default = 50)


