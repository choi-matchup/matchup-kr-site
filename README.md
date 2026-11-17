# MatchUp 한국 피팅룸 — matchup.fit/kr

한국 손님용 피팅룸 사이트. matchup.fit(미국 관리자의 Vercel)이 `/kr`, `/kr/*` 요청을 이 프로젝트에서 가져와
보여준다(rewrite). 그래서 주소는 matchup.fit/kr 그대로이고, 이 저장소·Vercel 프로젝트는 대표님 것이다.

## 어떻게 만들어지나
`node build-kr.js` 한 번에 `dist/`가 만들어진다(Vercel 빌드 명령).

- **틀(디자인)**: 운영 중인 영어 피팅룸 페이지(matchup.fit/fitting-room)와 신발 페이지를 빌드할 때마다 읽어 같은 모양으로 만든다.
  CSS·글꼴·화면 동작(site.js)도 영어 사이트 것을 쓴다 → 미국 쪽 디자인이 바뀌면 다음 빌드에서 따라간다.
- **글자**: `kr/fitting-room.ko.txt` 문구표(EN:/KO: 쌍)대로 바꾼다. 표에 없는 영어가 새로 생기면 빌드가 멈추고 그 글자를 알려 준다.
- **신발 목록·한국어 글**: 매치업 어드민 '일반 제품 설정 → 나라별 사이트(한국)'에서 정한 것을 서버 공개 API(`/api/v1/public/b2c/site/kr/shoes`)로 받는다.
- **사진·점수 숫자·구매처**: 각 신발의 '영어 원본 페이지'에서 그대로 가져온다.

## 고칠 때
| 무엇 | 어디서 |
|---|---|
| 신발 보이기·순서·이름·소개 글 | 어드민 '나라별 사이트' → 저장 → '사이트에 반영' |
| 첫 화면·메뉴·버튼 문구 | 이 저장소 `kr/fitting-room.ko.txt` |
| 신발 페이지 고정 문구(내 사이즈 찾기, QR 팝업 등) | `build-kr.js` 맨 위 `KO` |
| 디자인 | 미국 영어 사이트(따라옴) |

## Vercel 환경 변수
| 이름 | 운영 | 스테이징 |
|---|---|---|
| `MATCHUP_API` | https://api.matchup.fit | https://staging-api.matchup.fit |
| `MATCHUP_APP` | https://dev.matchup.fit | https://staging.matchup.fit |
| `SITE_URL` | https://matchup.fit | (스테이징 주소) |
| `NOINDEX` | (없음) | 1 |

빌드가 멈추면(영어 페이지·서버를 못 받거나 표에 없는 영어) Vercel은 앞 버전을 그대로 보여준다.
