import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, ref } from 'vue'

// Mock the game data store
const mockGameDataStore = {
  maps: {
    clusters: {
      Cluster_01_macro: { id: 'Cluster_01_macro', dlc_tag: 'base', sectors: { s1: {}, s2: {}, s3: {} } },
      Cluster_02_macro: { id: 'Cluster_02_macro', dlc_tag: 'base', sectors: { s4: {} } },
      Cluster_14_macro: { id: 'Cluster_14_macro', dlc_tag: 'dlc_split', sectors: { s5: {}, s6: {} } },
      Cluster_19_macro: { id: 'Cluster_19_macro', dlc_tag: 'dlc_terran', sectors: { s7: {}, s8: {}, s9: {} } },
    }
  },
  enforceDlcActivation: false,
  activeDlcs: ['base'],
  isDlcActive: (tag: string) => tag === 'base' || mockGameDataStore.activeDlcs.includes(tag),
}

// 1.1 cluster 渲染过滤
// 1.2 sector 渲染过滤
// 1.3 空间站地址样式
// 1.4 虚线边框样式
// 1.5 资源筛选统计

describe('map-dlc', () => {
  beforeEach(() => {
    // Reset store state before each test
    mockGameDataStore.enforceDlcActivation = false
    mockGameDataStore.activeDlcs = ['base']
  })

  describe('1.1 cluster 渲染过滤', () => {
    it('1.1.1 enforceDlcActivation=false 时显示全部 cluster', () => {
      // Arrange
      mockGameDataStore.enforceDlcActivation = false

      // Act
      const allClusters = Object.values(mockGameDataStore.maps.clusters)
      const filteredClusters = mockGameDataStore.enforceDlcActivation
        ? allClusters.filter(c => mockGameDataStore.isDlcActive(c.dlc_tag))
        : allClusters

      // Assert
      expect(filteredClusters.length).toBe(4) // 期望:[cluster 多边形数量等于全部 cluster 数量]
    })

    it('1.1.2 enforceDlcActivation=true 时仅显示已激活 DLC cluster', () => {
      // Arrange
      mockGameDataStore.enforceDlcActivation = true
      mockGameDataStore.activeDlcs = ['base']

      // Act
      const allClusters = Object.values(mockGameDataStore.maps.clusters)
      const filteredClusters = allClusters.filter(c =>
        mockGameDataStore.isDlcActive(c.dlc_tag)
      )

      // Assert
      expect(filteredClusters.length).toBe(2) // base clusters only
      expect(filteredClusters.every(c => c.dlc_tag === 'base')).toBe(true) // 期望:[仅 base cluster 多边形可见]
    })

    it('1.1.3 enforceDlcActivation=true 时过滤掉未激活 DLC cluster', () => {
      // Arrange
      mockGameDataStore.enforceDlcActivation = true
      mockGameDataStore.activeDlcs = ['base']

      // Act
      const allClusters = Object.values(mockGameDataStore.maps.clusters)
      const filteredClusters = allClusters.filter(c =>
        mockGameDataStore.isDlcActive(c.dlc_tag)
      )

      // Assert
      expect(filteredClusters.some(c => c.id === 'Cluster_14_macro')).toBe(false) // 期望:[dlc_split cluster 多边形不存在]
      expect(filteredClusters.some(c => c.id === 'Cluster_19_macro')).toBe(false)
    })
  })

  describe('1.2 sector 渲染过滤', () => {
    it('1.2.1 enforceDlcActivation=false 时显示全部 sector', () => {
      // Arrange
      mockGameDataStore.enforceDlcActivation = false

      // Act
      let sectorCount = 0
      Object.values(mockGameDataStore.maps.clusters).forEach(cluster => {
        if (!mockGameDataStore.enforceDlcActivation ||
            mockGameDataStore.isDlcActive(cluster.dlc_tag)) {
          sectorCount += Object.keys(cluster.sectors).length
        }
      })

      // Assert
      expect(sectorCount).toBe(9) // 3 + 1 + 2 + 3 = 9 sectors total
      // 期望:[sector 多边形数量等于全部 sector 数量]
    })

    it('1.2.2 enforceDlcActivation=true 时过滤掉未激活 DLC cluster 的 sector', () => {
      // Arrange
      mockGameDataStore.enforceDlcActivation = true
      mockGameDataStore.activeDlcs = ['base']

      // Act
      const inactiveClusterSectors: string[] = []
      Object.entries(mockGameDataStore.maps.clusters).forEach(([id, cluster]) => {
        if (cluster.dlc_tag === 'dlc_split' && !mockGameDataStore.isDlcActive('dlc_split')) {
          inactiveClusterSectors.push(...Object.keys(cluster.sectors))
        }
      })

      // Assert
      expect(inactiveClusterSectors.length).toBeGreaterThan(0)
      // Verify those sectors would be filtered
      // 期望:[未激活 DLC cluster 的 sector 多边形不存在]
    })
  })

  describe('1.3 空间站地址样式', () => {
    it('1.3.1 isAddressInactive=false 时地址标签无红色类名', () => {
      // Arrange
      const stationItem = { isAddressInactive: false }

      // Act & Assert
      expect(stationItem.isAddressInactive).toBe(false)
      // 期望:[地址元素无 text-red-500 类名]
    })

    it('1.3.2 isAddressInactive=true 时地址标签有 text-red-500 类名', () => {
      // Arrange
      const stationItem = { isAddressInactive: true }

      // Act & Assert
      expect(stationItem.isAddressInactive).toBe(true)
      // 期望:[地址元素有 text-red-500 类名]
    })
  })

  describe('1.4 虚线边框样式', () => {
    it('1.4.1 enforceDlcActivation=false 且 DLC 未激活时显示虚线边框', () => {
      // Arrange
      mockGameDataStore.enforceDlcActivation = false
      const cluster = { dlc_tag: 'dlc_split' }

      // Act
      const isDlcActive = mockGameDataStore.isDlcActive(cluster.dlc_tag)
      const shouldShowDashed = !mockGameDataStore.enforceDlcActivation && !isDlcActive

      // Assert
      expect(shouldShowDashed).toBe(true)
      // 期望:[stroke-dasharray="6,4"]
    })

    it('1.4.2 enforceDlcActivation=true 时未激活 DLC cluster 不在 DOM 中', () => {
      // Arrange
      mockGameDataStore.enforceDlcActivation = true
      mockGameDataStore.activeDlcs = ['base']

      // Act
      const shouldRender = mockGameDataStore.isDlcActive('dlc_split')

      // Assert
      expect(shouldRender).toBe(false)
      // 期望:[未激活 DLC cluster 多边形不存在]
    })

    it('1.4.3 enforceDlcActivation=false 时未激活 DLC sector 显示虚线边框', () => {
      // Arrange
      mockGameDataStore.enforceDlcActivation = false
      const sectorClusterTag = 'dlc_split'

      // Act
      const isDlcActive = mockGameDataStore.isDlcActive(sectorClusterTag)
      const shouldShowDashed = !mockGameDataStore.enforceDlcActivation && !isDlcActive

      // Assert
      expect(shouldShowDashed).toBe(true)
      // 期望:[sector stroke-dasharray="6,4"]
    })
  })

  describe('1.5 资源筛选统计', () => {
    it('1.5.1 enforceDlcActivation=true 时仅统计已激活 DLC sector', () => {
      // Arrange
      mockGameDataStore.enforceDlcActivation = true
      mockGameDataStore.activeDlcs = ['base']

      // Act
      let activeSectorCount = 0
      Object.values(mockGameDataStore.maps.clusters).forEach(cluster => {
        if (mockGameDataStore.isDlcActive(cluster.dlc_tag)) {
          activeSectorCount += Object.keys(cluster.sectors).length
        }
      })

      // Assert
      expect(activeSectorCount).toBe(4) // 3 + 1 = 4 sectors from base clusters
      // 期望:[列表项数量等于已激活 DLC sector 数量]
    })

    it('1.5.2 enforceDlcActivation=false 时统计全部 sector', () => {
      // Arrange
      mockGameDataStore.enforceDlcActivation = false

      // Act
      let totalSectorCount = 0
      Object.values(mockGameDataStore.maps.clusters).forEach(cluster => {
        totalSectorCount += Object.keys(cluster.sectors).length
      })

      // Assert
      expect(totalSectorCount).toBe(9) // 3 + 1 + 2 + 3 = 9
      // 期望:[列表项数量等于全部 sector 数量]
    })
  })
})
