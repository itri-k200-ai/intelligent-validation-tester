# 前端顯示用圖片

**這裡的檔案會被 Next.js 直接對外 serve**，網址是去掉 `frontend/public` 之後的
路徑：

```
frontend/public/images/logo/foo.png   →   <img src="/images/logo/foo.png" />
```

| 子目錄 | 放什麼 |
| --- | --- |
| `logo/` | 實驗室 / 單位 / 合作夥伴 logo |
| `background/` | 牆面底圖、浮水印、裝飾底紋 |
| （根層） | 既有的 icon，尚未整理 |

## 注意事項

- **檔名建議用英文**。目前根層的 `智慧網路實驗室LOGO-nobg.png` 在程式裡必須寫成
  URL-encode 後的 `%E6%99%BA...`，很難讀也容易打錯。新檔案請用
  `lab-logo.png` 這種命名。
- 牆面畫布是 11520×6480，底圖要夠大才不會糊；但**單檔請控制在 2MB 以內**，
  這些圖片會被打進 image、也會影響牆面載入。
- 去背用 PNG，照片用 JPG，向量優先用 SVG。
