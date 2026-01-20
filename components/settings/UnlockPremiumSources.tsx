import { useState } from 'react';

interface UnlockPremiumSourcesProps {
    unlocked: boolean;
    onUnlock: (key: string) => Promise<boolean>;
}

export function UnlockPremiumSources({ unlocked, onUnlock }: UnlockPremiumSourcesProps) {
    const [key, setKey] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [message, setMessage] = useState('');

    const handleUnlock = async () => {
        if (!key.trim()) {
            setMessage('请输入解锁秘钥');
            return;
        }

        setIsVerifying(true);
        setMessage('');

        try {
            const success = await onUnlock(key);
            if (success) {
                setMessage('✅ 解锁成功！高级视频源已启用');
                setKey('');
            } else {
                setMessage('❌ 秘钥错误，请重试');
            }
        } catch (error) {
            setMessage('❌ 验证失败，请稍后重试');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isVerifying) {
            handleUnlock();
        }
    };

    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-sm)] p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-[var(--text-color)]">🔐 解锁高级视频源</h2>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    unlocked 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                }`}>
                    {unlocked ? '已解锁' : '未解锁'}
                </div>
            </div>

            {unlocked ? (
                <div className="space-y-3">
                    <p className="text-sm text-[var(--text-color-secondary)]">
                        ✨ 您已成功解锁全部25个视频源（包括16个高级源）
                    </p>
                    <div className="bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] border border-[var(--accent-color)] rounded-[var(--radius-xl)] p-4">
                        <p className="text-sm text-[var(--text-color)]">
                            💡 高级源已添加到视频源列表中，您可以在下方的"视频源管理"中查看和管理它们
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <p className="text-sm text-[var(--text-color-secondary)]">
                        输入解锁秘钥以启用16个高级视频源，扩展视频内容库
                    </p>
                    
                    <div className="flex gap-2">
                        <input
                            type="password"
                            placeholder="请输入解锁秘钥"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isVerifying}
                            className="flex-1 px-4 py-2 rounded-[var(--radius-2xl)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color)] placeholder-[var(--text-color-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] transition-all duration-200 disabled:opacity-50"
                        />
                        <button
                            onClick={handleUnlock}
                            disabled={isVerifying || !key.trim()}
                            className="px-6 py-2 rounded-[var(--radius-2xl)] bg-[var(--accent-color)] text-white text-sm font-semibold hover:brightness-110 hover:-translate-y-0.5 shadow-[var(--shadow-sm)] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                        >
                            {isVerifying ? '验证中...' : '解锁'}
                        </button>
                    </div>

                    {message && (
                        <div className={`p-3 rounded-[var(--radius-xl)] text-sm ${
                            message.includes('✅') 
                                ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200' 
                                : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                        }`}>
                            {message}
                        </div>
                    )}

                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-[var(--radius-xl)] p-4">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                            💡 提示：如果您不知道解锁秘钥，请联系管理员获取
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
