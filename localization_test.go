package main

import (
	"fmt"
	"testing"
)

func TestLocalizedMessages(t *testing.T) {
	if got := localizedMessage("en", "native.chooseResources"); got != "Choose WeChat resource folder" {
		t.Fatal(got)
	}
	if got := localizedMessage("unknown", "native.chooseResources"); got != "选择微信资源目录" {
		t.Fatal(got)
	}
	if got := localizedError("en", "收藏文件读取失败: /tmp/中文.json"); got != "Could not read favorites: /tmp/中文.json" {
		t.Fatal(got)
	}
	if got := localizedError("zh-CN", "标签过长"); got != "标签过长" {
		t.Fatal(got)
	}
	if got := localizedError("en", "unexpected failure"); got != "unexpected failure" {
		t.Fatal(got)
	}
	if got := fmt.Sprintf(localizedMessage("en", "errors.unknownConversation"), "目录哈希"); got != "Unknown conversation folder: 目录哈希" {
		t.Fatal(got)
	}
}
