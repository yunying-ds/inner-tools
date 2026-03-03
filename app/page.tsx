import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="max-w-sm w-full space-y-10">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-medium tracking-tight">Inner Tools</h1>
          <p className="text-sm text-muted-foreground">内在工具箱</p>
        </div>

        {/* 圣多纳方法介绍 */}
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-base font-medium">圣多纳释放法</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              一种通过温和地问自己几个问题，来释放卡住的情绪的方法。不需要分析原因，不需要回忆过去——只是允许感受存在，然后选择放下。
            </p>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex gap-2.5">
              <span className="text-primary/60 shrink-0">1.</span>
              <span>说出此刻的感受，AI 帮你识别情绪</span>
            </div>
            <div className="flex gap-2.5">
              <span className="text-primary/60 shrink-0">2.</span>
              <span>通过几个简单的「是 / 否」问题，一步步松开它</span>
            </div>
            <div className="flex gap-2.5">
              <span className="text-primary/60 shrink-0">3.</span>
              <span>探索情绪背后的深层「想要」，从根源释放</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/70 leading-relaxed border-l-2 border-border pl-3">
            「想要」是指内心深处的渴望，比如想被认可、想有安全感、想掌控局面——情绪往往是这些未被满足的渴望的信号。
          </p>
        </div>

        <div className="space-y-3">
          <Link href="/release/session" className="block">
            <Button className="w-full" size="lg">
              开始圣多纳释放
            </Button>
          </Link>
          <Link href="/release/history" className="block">
            <Button variant="outline" className="w-full">
              查看释放记录
            </Button>
          </Link>
        </div>

        <p className="text-xs text-muted-foreground text-center">塔罗功能即将上线</p>
      </div>
    </div>
  );
}
