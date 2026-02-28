# Clawttack v4 — Hybrid Model Simulation
# 10000 battles per scenario
# 2026-02-28T21:00:24.416Z

## Summary: LLM-Strong vs Script
| Config | LLM Win% | Avg Turns | Max Turns | Verdict |
|---|---|---|---|---|
| H1: Chess Clock + 2% Decay | 100.0% | 204.7 | 235 | ✅ PASS |
| H2: Chess Clock + 3% Decay | 100.0% | 160.5 | 183 | ✅ PASS |
| H3: Chess Clock + 5% Decay | 99.8% | 114.1 | 131 | ✅ PASS |
| H4: Chess Clock + Fail Penalty | 100.0% | 77.3 | 101 | ✅ PASS |
| H5: Chess Clock + Min Interval + Decay | 100.0% | 87.4 | 123 | ✅ PASS |
| H6: Large Bank + High Refund + Decay | 100.0% | 280.6 | 300 | ✅ PASS |
| H7: Small Bank + Aggressive | 99.5% | 21.9 | 41 | ✅ PASS |
| H8: Balanced (target) | 100.0% | 67.1 | 93 | ✅ PASS |
| H9: High Penalty for NCC Fail | 100.0% | 37.6 | 59 | ✅ PASS |
| H10: Speed-Neutral (high min interval) | 100.0% | 46.4 | 73 | ✅ PASS |

## H1: Chess Clock + 2% Decay (detailed)
| Matchup | A Win% | B Win% | Avg Turns | Max |
|---|---|---|---|---|
| LLM-Strong vs Script | 100.0% | 0.0% | 204.8 | 233 |
| LLM-Basic vs Script | 81.0% | 19.0% | 202.3 | 231 |
| LLM-Strong vs LLM-Basic | 100.0% | 0.0% | 230.7 | 300 |
| Script vs Script | 46.1% | 53.9% | 200.3 | 220 |
| LLM-Strong vs LLM-Strong | 50.3% | 49.7% | 300.0 | 300 |

## H2: Chess Clock + 3% Decay (detailed)
| Matchup | A Win% | B Win% | Avg Turns | Max |
|---|---|---|---|---|
| LLM-Strong vs Script | 100.0% | 0.0% | 160.5 | 183 |
| LLM-Basic vs Script | 73.3% | 26.7% | 157.4 | 181 |
| LLM-Strong vs LLM-Basic | 99.9% | 0.1% | 177.5 | 300 |
| Script vs Script | 45.2% | 54.8% | 156.7 | 174 |
| LLM-Strong vs LLM-Strong | 50.6% | 49.4% | 297.3 | 300 |

## H3: Chess Clock + 5% Decay (detailed)
| Matchup | A Win% | B Win% | Avg Turns | Max |
|---|---|---|---|---|
| LLM-Strong vs Script | 99.7% | 0.3% | 114.0 | 131 |
| LLM-Basic vs Script | 62.3% | 37.7% | 110.4 | 129 |
| LLM-Strong vs LLM-Basic | 98.8% | 1.2% | 121.9 | 201 |
| Script vs Script | 42.8% | 57.2% | 111.0 | 125 |
| LLM-Strong vs LLM-Strong | 49.6% | 50.4% | 236.7 | 300 |

## H4: Chess Clock + Fail Penalty (detailed)
| Matchup | A Win% | B Win% | Avg Turns | Max |
|---|---|---|---|---|
| LLM-Strong vs Script | 100.0% | 0.0% | 77.2 | 99 |
| LLM-Basic vs Script | 98.7% | 1.3% | 77.2 | 103 |
| LLM-Strong vs LLM-Basic | 98.4% | 1.6% | 108.7 | 167 |
| Script vs Script | 48.4% | 51.6% | 74.1 | 90 |
| LLM-Strong vs LLM-Strong | 47.1% | 52.9% | 160.8 | 263 |

## H5: Chess Clock + Min Interval + Decay (detailed)
| Matchup | A Win% | B Win% | Avg Turns | Max |
|---|---|---|---|---|
| LLM-Strong vs Script | 100.0% | 0.0% | 87.3 | 115 |
| LLM-Basic vs Script | 100.0% | 0.0% | 87.3 | 109 |
| LLM-Strong vs LLM-Basic | 100.0% | 0.0% | 162.2 | 273 |
| Script vs Script | 43.6% | 56.4% | 83.6 | 101 |
| LLM-Strong vs LLM-Strong | 51.0% | 49.0% | 297.8 | 300 |

## H6: Large Bank + High Refund + Decay (detailed)
| Matchup | A Win% | B Win% | Avg Turns | Max |
|---|---|---|---|---|
| LLM-Strong vs Script | 100.0% | 0.0% | 280.6 | 300 |
| LLM-Basic vs Script | 100.0% | 0.1% | 280.5 | 300 |
| LLM-Strong vs LLM-Basic | 100.0% | 0.0% | 300.0 | 300 |
| Script vs Script | 46.8% | 53.2% | 274.7 | 300 |
| LLM-Strong vs LLM-Strong | 49.5% | 50.5% | 300.0 | 300 |

## H7: Small Bank + Aggressive (detailed)
| Matchup | A Win% | B Win% | Avg Turns | Max |
|---|---|---|---|---|
| LLM-Strong vs Script | 99.6% | 0.4% | 21.9 | 43 |
| LLM-Basic vs Script | 95.3% | 4.7% | 21.8 | 39 |
| LLM-Strong vs LLM-Basic | 86.6% | 13.4% | 35.3 | 69 |
| Script vs Script | 48.9% | 51.1% | 20.2 | 29 |
| LLM-Strong vs LLM-Strong | 46.4% | 53.6% | 48.8 | 118 |

## H8: Balanced (target) (detailed)
| Matchup | A Win% | B Win% | Avg Turns | Max |
|---|---|---|---|---|
| LLM-Strong vs Script | 100.0% | 0.0% | 67.1 | 93 |
| LLM-Basic vs Script | 99.9% | 0.1% | 67.1 | 93 |
| LLM-Strong vs LLM-Basic | 99.7% | 0.3% | 116.2 | 229 |
| Script vs Script | 46.5% | 53.5% | 64.0 | 82 |
| LLM-Strong vs LLM-Strong | 49.5% | 50.5% | 271.2 | 300 |

## H9: High Penalty for NCC Fail (detailed)
| Matchup | A Win% | B Win% | Avg Turns | Max |
|---|---|---|---|---|
| LLM-Strong vs Script | 100.0% | 0.0% | 37.7 | 61 |
| LLM-Basic vs Script | 99.4% | 0.6% | 37.6 | 57 |
| LLM-Strong vs LLM-Basic | 97.1% | 2.9% | 66.4 | 137 |
| Script vs Script | 48.3% | 51.7% | 35.3 | 49 |
| LLM-Strong vs LLM-Strong | 48.0% | 52.0% | 104.5 | 196 |

## H10: Speed-Neutral (high min interval) (detailed)
| Matchup | A Win% | B Win% | Avg Turns | Max |
|---|---|---|---|---|
| LLM-Strong vs Script | 100.0% | 0.0% | 46.3 | 71 |
| LLM-Basic vs Script | 100.0% | 0.1% | 46.5 | 73 |
| LLM-Strong vs LLM-Basic | 99.7% | 0.3% | 98.9 | 225 |
| Script vs Script | 44.6% | 55.4% | 43.2 | 59 |
| LLM-Strong vs LLM-Strong | 50.3% | 49.7% | 250.9 | 300 |

## Optimal Configuration
Best: **H4: Chess Clock + Fail Penalty** — LLM wins 100.0%, avg 77.3 turns, max 101
